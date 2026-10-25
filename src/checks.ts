import type { ConfigFile, Located, McpServer } from "./configs.js";
import { findNamedSecret, findSecret } from "./secrets.js";
import type { Check, Finding } from "./types.js";
import { severityRank } from "./types.js";

export const checks: Check[] = [
  {
    id: "AC001",
    severity: "high",
    title: "Hardcoded secret",
    description:
      "A token, password or key is written in the config instead of referenced from the environment.",
  },
  {
    id: "AC002",
    severity: "medium",
    title: "Unpinned MCP package",
    description:
      "The server runs whatever version of the package is newest each time it starts (npx/bunx/uvx without an exact version).",
  },
  {
    id: "AC003",
    severity: "high",
    title: "MCP server over plain HTTP",
    description:
      "A remote MCP server is reached without TLS, so traffic and tokens can be read or changed on the way.",
  },
  {
    id: "AC004",
    severity: "medium",
    title: "Broad filesystem access",
    description: "An MCP server is given the whole disk or home directory.",
  },
  {
    id: "AC005",
    severity: "high",
    title: "Permission prompts bypassed",
    description: "Claude Code is set to run every tool without asking.",
  },
  {
    id: "AC006",
    severity: "high",
    title: "Every shell command allowed",
    description: "A permission rule allows any Bash command without a prompt.",
  },
  {
    id: "AC007",
    severity: "medium",
    title: "Project MCP servers auto-approved",
    description:
      "Every MCP server in a repository's .mcp.json is started without asking, including ones added by someone else.",
  },
  {
    id: "AC008",
    severity: "high",
    title: "Container with host access",
    description:
      "An MCP server runs in a container that can reach the host (privileged, host root or Docker socket mounted).",
  },
  {
    id: "AC009",
    severity: "high",
    title: "Remote script piped to a shell",
    description:
      "A hook downloads a script and runs it, so whoever controls that URL runs code on every tool call.",
  },
  {
    id: "AC010",
    severity: "low",
    title: "Secret input not masked",
    description: "A VS Code input for a secret is not marked password: true, so it is shown while typed.",
  },
];

const runners: Record<string, string[]> = {
  npx: [],
  bunx: [],
  uvx: [],
  pnpm: ["dlx"],
  yarn: ["dlx"],
  pipx: ["run"],
};

/** The package a runner command starts, e.g. "@scope/pkg@1.2.3" from npx -y @scope/pkg@1.2.3. */
export function packageSpec(command: string, args: string[]): string | undefined {
  const bin = command.split("/").pop() ?? command;
  const sub = runners[bin];
  if (!sub) return undefined;
  let rest = args;
  for (const s of sub) {
    if (rest[0] !== s) return undefined;
    rest = rest.slice(1);
  }
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i] ?? "";
    if (a === "-p" || a === "--package" || a === "--from") return rest[i + 1];
    if (a.startsWith("--package=") || a.startsWith("--from=")) return a.slice(a.indexOf("=") + 1);
    if (a.startsWith("-")) continue;
    return a;
  }
  return undefined;
}

export type Pinning = "exact" | "range" | "tag" | "none";

export function pinning(spec: string): Pinning {
  // npm: name@version (scoped names start with @); Python: name==version or name@version.
  const py = /^[A-Za-z0-9_.-]+(\[[^\]]*\])?==\s*[\w.+-]+$/.test(spec);
  if (py) return "exact";
  const at = spec.lastIndexOf("@");
  if (at <= 0) return "none";
  const version = spec.slice(at + 1);
  if (/^v?\d+\.\d+\.\d+([-+][\w.-]+)?$/.test(version)) return "exact";
  if (/^[\^~<>=*x\d]/.test(version)) return "range";
  return "tag";
}

const localHosts = /^(localhost|127\.\d+\.\d+\.\d+|\[?::1\]?|0\.0\.0\.0|host\.docker\.internal)$/;
const broadPaths = new Set(["/", "~", "~/", "$HOME", "${HOME}", "/Users", "/home", "C:\\", "C:/", "/root"]);

export function audit(cfg: ConfigFile): Finding[] {
  const out: Finding[] = cfg.errors.map((e) => ({
    ruleId: "PARSE",
    severity: "low" as const,
    target: cfg.file,
    file: cfg.file,
    line: e.line,
    message: `could not parse: ${e.message}`,
  }));
  const add = (
    target: string,
    line: number,
    f: Pick<Finding, "ruleId" | "severity" | "message"> & { help?: string },
  ) => out.push({ ...f, target, file: cfg.file, line });

  const secret = (target: string, where: string, loc: Located<string>, name?: string) => {
    const m = name === undefined ? findSecret(loc.value) : findNamedSecret(name, loc.value);
    if (!m) return;
    add(target, loc.line, {
      ruleId: "AC001",
      severity: "high",
      message: `${target}: ${m.kind} hardcoded in ${where} (${m.preview})`,
      help: cfg.shared
        ? "This file is usually committed: rotate the secret, then reference it from the environment (${VAR} / ${env:VAR} / ${input:id})."
        : "Reference it from the environment (${VAR} / ${env:VAR} / ${input:id}) or a credential helper instead of the file.",
    });
  };

  for (const s of cfg.servers) checkServer(s, add, secret);

  const st = cfg.settings;
  if (st) {
    for (const [k, v] of Object.entries(st.env)) secret("settings", `env.${k}`, v, k);
    for (const rule of st.allow) {
      secret("settings", "a permission rule", rule);
      if (/^Bash(\((\*|:\*)?\))?$/.test(rule.value)) {
        add("settings", rule.line, {
          ruleId: "AC006",
          severity: "high",
          message: `permissions.allow has "${rule.value}", so any shell command runs without a prompt`,
          help: 'Allow specific commands instead, e.g. "Bash(npm test *)", and keep a deny list for destructive ones.',
        });
      }
    }
    if (st.defaultMode?.value === "bypassPermissions") {
      add("settings", st.defaultMode.line, {
        ruleId: "AC005",
        severity: "high",
        message: 'permissions.defaultMode is "bypassPermissions": every tool runs without asking',
        help: 'Use "acceptEdits" or "auto", or set permissions.disableBypassPermissionsMode to "disable".',
      });
    }
    if (st.skipDangerousPrompt?.value === true) {
      add("settings", st.skipDangerousPrompt.line, {
        ruleId: "AC005",
        severity: "medium",
        message:
          "skipDangerousModePermissionPrompt is true: entering bypass mode no longer asks for confirmation",
      });
    }
    if (st.enableAllProjectMcpServers?.value === true) {
      add("settings", st.enableAllProjectMcpServers.line, {
        ruleId: "AC007",
        severity: "medium",
        message:
          "enableAllProjectMcpServers is true: any MCP server added to a repository's .mcp.json starts without asking",
        help: "List trusted servers in enabledMcpjsonServers instead.",
      });
    }
    for (const c of st.hookCommands) {
      secret("hooks", "a hook command", c);
      if (/\b(curl|wget)\b[^|]*\|\s*(sudo\s+)?(ba|z|da)?sh\b/.test(c.value)) {
        add("hooks", c.line, {
          ruleId: "AC009",
          severity: "high",
          message: "a hook pipes a downloaded script into a shell",
          help: "Vendor the script into the repository (or pin it by checksum) and run the local copy.",
        });
      }
    }
  }

  for (const input of cfg.plainInputs) {
    add(`input:${input.value}`, input.line, {
      ruleId: "AC010",
      severity: "low",
      message: `input "${input.value}" looks like a secret but is not marked password: true`,
    });
  }

  return out.sort(
    (a, b) =>
      severityRank[b.severity] - severityRank[a.severity] ||
      a.line - b.line ||
      a.ruleId.localeCompare(b.ruleId),
  );
}

function checkServer(
  s: McpServer,
  add: (
    target: string,
    line: number,
    f: Pick<Finding, "ruleId" | "severity" | "message"> & { help?: string },
  ) => void,
  secret: (target: string, where: string, loc: Located<string>, name?: string) => void,
) {
  const t = s.name;
  for (const [k, v] of Object.entries(s.env)) secret(t, `env.${k}`, v, k);
  for (const [k, v] of Object.entries(s.headers)) secret(t, `headers.${k}`, v, k);
  for (const a of s.args) secret(t, "args", a);
  if (s.command) secret(t, "command", s.command);
  if (s.url) secret(t, "url", s.url);

  if (s.command) {
    const args = s.args.map((a) => a.value);
    const spec = packageSpec(s.command.value, args);
    const p = spec === undefined ? undefined : pinning(spec);
    if (spec !== undefined && p !== "exact") {
      add(t, s.command.line, {
        ruleId: "AC002",
        severity: p === "range" ? "low" : "medium",
        message:
          p === "range"
            ? `${t} runs ${spec}: a version range, so new releases start automatically`
            : `${t} runs ${spec} without a pinned version, so every start may fetch a newly published release`,
        help: `Pin an exact version (e.g. ${spec.replace(/@[^@/]*$/, "")}@1.2.3) and update it deliberately; hijacked releases are usually pulled within days.`,
      });
    }

    const bin = s.command.value.split("/").pop();
    if (bin === "docker" || bin === "podman") {
      const joined = args.join(" ");
      if (
        /--privileged\b|(-v|--volume|--mount)[ =](\/|[^ ]*src=\/)(:| |,|$)|docker\.sock|--pid[ =]host|--network[ =]host/.test(
          joined,
        )
      ) {
        add(t, s.command.line, {
          ruleId: "AC008",
          severity: "high",
          message: `${t} runs a container that can reach the host`,
          help: "Drop --privileged, host namespaces and host mounts; mount only the directory the server needs, read-only if possible.",
        });
      }
    }
  }

  if (s.url) {
    try {
      const u = new URL(s.url.value.replace(/\$\{[^}]*\}/g, "x"));
      if ((u.protocol === "http:" || u.protocol === "ws:") && !localHosts.test(u.hostname)) {
        add(t, s.url.line, {
          ruleId: "AC003",
          severity: "high",
          message: `${t} connects to ${u.protocol}//${u.host} without TLS`,
          help: "Use https:// (or wss://) for anything that leaves this machine.",
        });
      }
    } catch {
      // Not a URL we can judge.
    }
  }

  for (const a of s.args) {
    if (broadPaths.has(a.value.trim())) {
      add(t, a.line, {
        ruleId: "AC004",
        severity: "medium",
        message: `${t} is given access to ${a.value}`,
        help: "Pass only the project directories the server needs.",
      });
    }
  }
}
