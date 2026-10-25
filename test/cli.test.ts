import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isEntryPoint, main } from "../src/cli.js";
import { homeConfigs } from "../src/scan.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const fx = (p: string) => path.join(root, "test/fixtures", p);

async function run(args: string[], home: string[] = []) {
  let stdout = "";
  let stderr = "";
  const code = await main(args, {
    stdout: (s) => (stdout += s),
    stderr: (s) => (stderr += s),
    cwd: root,
    home: () => home,
  });
  return { code, stdout, stderr };
}

describe("main", () => {
  it("audits every config in a repository", async () => {
    const r = await run([fx("repo")]);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain("test/fixtures/repo/.mcp.json:18  HIGH   AC003");
    expect(r.stdout).toContain("4 file(s), 15 finding(s): 9 high, 4 medium, 2 low");
    expect(r.stdout).not.toContain("Sup3rS3cretPw");
  });

  it("passes a clean repository and skips unrelated JSON", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "aca-"));
    writeFileSync(path.join(dir, "package.json"), '{"name":"x"}');
    mkdirSync(path.join(dir, "node_modules/x/.claude"), { recursive: true });
    writeFileSync(
      path.join(dir, "node_modules/x/.claude/settings.json"),
      '{"permissions":{"allow":["Bash"]}}',
    );
    writeFileSync(path.join(dir, ".mcp.json"), '{"mcpServers":{}}');
    expect(await run([dir])).toMatchObject({ code: 0 });
    expect((await run([fx("clean")])).code).toBe(0);
  });

  it("--home adds personal configs and skips missing ones", async () => {
    const r = await run(["--home"], [path.join(fx("repo"), ".claude/settings.json"), "/no/such/file.json"]);
    expect(r.stdout).toContain("1 file(s), 5 finding(s)");
  });

  it("accepts a config file directly, but not other files", async () => {
    expect((await run(["--fail-on", "none", path.join(fx("repo"), ".cursor/mcp.json")])).stdout).toContain(
      "1 file(s), 1 finding(s)",
    );
    expect((await run([path.join(root, "package.json")])).stderr).toContain(
      "no agent or MCP configuration found",
    );
  });

  it("renders json, markdown and sarif", async () => {
    const json = JSON.parse((await run(["--format", "json", "--fail-on", "none", fx("repo")])).stdout) as {
      summary: object;
    };
    expect(json.summary).toEqual({ high: 9, medium: 4, low: 2 });
    expect((await run(["--format", "markdown", "--fail-on", "none", fx("repo")])).stdout).toContain(
      "| Severity | Check | Where | Problem | What to do |",
    );
    const sarif = JSON.parse((await run(["--format", "sarif", "--fail-on", "none", fx("repo")])).stdout) as {
      runs: { tool: { driver: { name: string; rules: unknown[] } } }[];
    };
    expect(sarif.runs[0]?.tool.driver).toMatchObject({ name: "agent-config-audit" });
    expect(sarif.runs[0]?.tool.driver.rules).toHaveLength(10);
  });

  it("--fail-on decides the exit code", async () => {
    expect((await run(["--fail-on", "none", fx("repo")])).code).toBe(0);
    expect((await run(["--fail-on", "low", fx("repo/.vscode")])).code).toBe(1);
    expect((await run(["--fail-on", "medium", fx("repo/.vscode")])).code).toBe(0);
  });

  it("prints help, version and checks", async () => {
    expect((await run(["-h"])).stdout).toContain("Secrets are never printed in full.");
    expect((await run(["--version"])).stdout).toBe("agent-config-audit dev\n");
    expect((await run(["--list-checks"])).stdout.trim().split("\n")).toHaveLength(10);
  });

  it.each([
    [["--bogus"], /Unknown option/],
    [["--format", "xml"], /unknown format/],
    [["--fail-on", "critical"], /--fail-on must be/],
    [["/does/not/exist"], /ENOENT/],
  ])("rejects %j", async (args, msg) => {
    const r = await run(args);
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(msg);
  });
});

describe("homeConfigs", () => {
  it("knows where each tool keeps its personal config", () => {
    expect(homeConfigs("/h", "darwin", {})).toEqual([
      "/h/.claude/settings.json",
      "/h/.claude.json",
      "/h/.cursor/mcp.json",
      "/h/Library/Application Support/Claude/claude_desktop_config.json",
    ]);
    expect(homeConfigs("/h", "linux", {})[3]).toBe("/h/.config/Claude/claude_desktop_config.json");
    expect(homeConfigs("/h", "win32", { APPDATA: "/appdata" })[3]).toBe(
      "/appdata/Claude/claude_desktop_config.json",
    );
    expect(homeConfigs("/h", "win32", {})[3]).toBe("/h/AppData/Roaming/Claude/claude_desktop_config.json");
  });
});

describe("isEntryPoint", () => {
  const self = new URL("../src/cli.ts", import.meta.url).href;
  it("follows symlinks and rejects other files", () => {
    const link = path.join(mkdtempSync(path.join(tmpdir(), "aca-")), "agent-config-audit");
    symlinkSync(fileURLToPath(self), link);
    expect(isEntryPoint(link, self)).toBe(true);
    expect(isEntryPoint(undefined, self)).toBe(false);
    expect(isEntryPoint("/no/such/file", self)).toBe(false);
  });
});
