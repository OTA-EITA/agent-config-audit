import { readdir, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { audit } from "./checks.js";
import { kindOf, parseConfig } from "./configs.js";
import type { Finding } from "./types.js";

const skipDirs = new Set(["node_modules", ".git", "dist", "vendor", ".venv"]);

/** Personal configs outside any repository. */
export function homeConfigs(home = homedir(), platform = process.platform, env = process.env): string[] {
  const desktop =
    platform === "darwin"
      ? path.join(home, "Library/Application Support/Claude/claude_desktop_config.json")
      : platform === "win32"
        ? path.join(env.APPDATA ?? path.join(home, "AppData/Roaming"), "Claude/claude_desktop_config.json")
        : path.join(home, ".config/Claude/claude_desktop_config.json");
  return [
    path.join(home, ".claude/settings.json"),
    path.join(home, ".claude.json"),
    path.join(home, ".cursor/mcp.json"),
    desktop,
  ];
}

/** Config files under a path. A file path is used if its name is a known config. */
export async function findConfigs(root: string): Promise<string[]> {
  if ((await stat(root)).isFile()) return kindOf(root) ? [root] : [];
  const out: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    const entries = (await readdir(dir, { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!skipDirs.has(e.name)) await walk(p);
      } else if (kindOf(p)) out.push(p);
    }
  };
  await walk(root);
  return out;
}

export interface ScanResult {
  findings: Finding[];
  files: number;
  servers: number;
}

export async function scan(paths: string[], cwd: string, home: string[] = []): Promise<ScanResult> {
  const result: ScanResult = { findings: [], files: 0, servers: 0 };
  const files = [...(await Promise.all(paths.map(findConfigs))).flat()];
  for (const h of home) {
    try {
      if ((await stat(h)).isFile()) files.push(h);
    } catch {
      // Not installed.
    }
  }
  for (const file of [...new Set(files)]) {
    const kind = kindOf(file);
    if (!kind) continue;
    const rel =
      path.isAbsolute(file) && !file.startsWith(cwd)
        ? file.replace(homedir(), "~")
        : path.relative(cwd, file) || file;
    const cfg = parseConfig(rel.split(path.sep).join("/"), await readFile(file, "utf8"), kind);
    result.files++;
    result.servers += cfg.servers.length;
    result.findings.push(...audit(cfg));
  }
  return result;
}
