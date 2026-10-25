import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { checks } from "./checks.js";
import { formats, render } from "./report.js";
import type { Format } from "./report.js";
import { homeConfigs, scan } from "./scan.js";
import { severityRank } from "./types.js";
import type { Severity } from "./types.js";

declare const __VERSION__: string | undefined;
const version = typeof __VERSION__ === "string" ? __VERSION__ : "dev";

const usage = `usage: agent-config-audit [options] [path ...]

Audits AI coding agent and MCP configuration: .mcp.json, .claude/settings*.json,
.cursor/mcp.json, .vscode/mcp.json and claude_desktop_config.json. Paths
default to the current directory.

options:
  --home                 also audit your personal configs (~/.claude, ~/.claude.json, ~/.cursor, Claude Desktop)
  --format <format>      text, json, markdown or sarif (default: text)
  --fail-on <severity>   exit 1 on findings at least this severe: high, medium, low or none (default: medium)
  --list-checks          print the checks and exit
  --version              print the version and exit
  -h, --help             show this help

Secrets are never printed in full.
`;

export interface Io {
  stdout: (s: string) => void;
  stderr: (s: string) => void;
  cwd: string;
  /** Personal config paths for --home; replaced in tests. */
  home: () => string[];
}

export async function main(argv: string[], io: Io): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        home: { type: "boolean", default: false },
        format: { type: "string", default: "text" },
        "fail-on": { type: "string", default: "medium" },
        "list-checks": { type: "boolean", default: false },
        version: { type: "boolean", default: false },
        help: { type: "boolean", short: "h", default: false },
      },
    });
  } catch (err) {
    io.stderr(`error: ${(err as Error).message}\n\n${usage}`);
    return 2;
  }
  const { values, positionals } = parsed;
  if (values.help) {
    io.stdout(usage);
    return 0;
  }
  if (values.version) {
    io.stdout(`agent-config-audit ${version}\n`);
    return 0;
  }
  if (values["list-checks"]) {
    io.stdout(
      checks.map((c) => `${c.id}  ${c.severity.padEnd(6)}  ${c.title}: ${c.description}`).join("\n") + "\n",
    );
    return 0;
  }
  if (!(formats as string[]).includes(values.format)) {
    io.stderr(`error: unknown format "${values.format}" (want ${formats.join(", ")})\n`);
    return 2;
  }
  const failOn = values["fail-on"];
  if (failOn !== "none" && !(failOn in severityRank)) {
    io.stderr(`error: --fail-on must be high, medium, low or none, got "${failOn}"\n`);
    return 2;
  }

  let result;
  try {
    const paths = positionals.length ? positionals : values.home ? [] : ["."];
    result = await scan(paths, io.cwd, values.home ? io.home() : []);
  } catch (err) {
    io.stderr(`error: ${(err as Error).message}\n`);
    return 2;
  }
  if (result.files === 0) {
    io.stderr("error: no agent or MCP configuration found\n");
    return 2;
  }
  io.stdout(
    render(result.findings, values.format as Format, { files: result.files, rules: checks, version }),
  );
  if (failOn === "none") return 0;
  return result.findings.some((f) => severityRank[f.severity] >= severityRank[failOn as Severity]) ? 1 : 0;
}

/** True when this module is the program being run, also through npm's bin symlink. */
export function isEntryPoint(argv1: string | undefined, moduleUrl: string): boolean {
  if (!argv1) return false;
  try {
    return realpathSync(argv1) === realpathSync(fileURLToPath(moduleUrl));
  } catch {
    return false;
  }
}

// Exercised by the packaged-binary check in CI rather than unit tests.
/* v8 ignore start */
if (isEntryPoint(process.argv[1], import.meta.url)) {
  main(process.argv.slice(2), {
    stdout: (s) => process.stdout.write(s),
    stderr: (s) => process.stderr.write(s),
    cwd: process.cwd(),
    home: () => homeConfigs(),
  }).then(
    (code) => {
      process.exitCode = code;
    },
    (err: unknown) => {
      process.stderr.write(`error: ${String(err)}\n`);
      process.exitCode = 2;
    },
  );
}
/* v8 ignore stop */
