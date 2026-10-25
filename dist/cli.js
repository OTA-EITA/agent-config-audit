#!/usr/bin/env node
import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);

// src/cli.ts
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

// src/secrets.ts
var reference = /\$\{(env:|input:)?[A-Za-z_][A-Za-z0-9_.-]*(:-[^}]*)?\}/;
var placeholder = /^(<[^>]*>|\[[^\]]*\]|your[_-]?\w*|x{3,}|\*{3,}|changeme|placeholder|example|dummy|test|none|null|todo|\.\.\.)$/i;
var tokenFormats = [
  ["GitHub token", /\b(gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})\b/],
  ["Slack token", /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ["AWS access key", /\b(AKIA|ASIA)[A-Z0-9]{16}\b/],
  ["Anthropic API key", /\bsk-ant-[A-Za-z0-9_-]{20,}/],
  ["OpenAI API key", /\bsk-(proj-)?[A-Za-z0-9_-]{32,}/],
  ["Google API key", /\bAIza[A-Za-z0-9_-]{35}\b/],
  ["Stripe secret key", /\b[rs]k_live_[A-Za-z0-9]{20,}/],
  ["npm token", /\bnpm_[A-Za-z0-9]{36}\b/],
  ["private key", /-----BEGIN (RSA |EC |OPENSSH |DSA |)PRIVATE KEY-----/]
];
var inlineAssignment = /\b([A-Z0-9_]*(PASSWORD|PASSWD|SECRET|TOKEN|API_?KEY|ACCESS_KEY)[A-Z0-9_]*)=(['"]?)([^\s'"]{6,})\3/;
var urlCredentials = /\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:([^\s@/]{3,})@([^\s/:?]+)/i;
var localDefaults = /^(postgres|password|pass|root|admin|mysql|secret|test|dev|example)$/i;
var localHost = /^(localhost|127\.\d+\.\d+\.\d+|\[?::1\]?|0\.0\.0\.0|host\.docker\.internal)$/i;
var secretName = /(token|secret|passw(or)?d|api[_-]?key|access[_-]?key|private[_-]?key|credential|auth(orization)?|cookie|session)/i;
function mask(value) {
  const v = value.trim();
  if (v.length <= 8) return `${"*".repeat(v.length)} (${String(v.length)} chars)`;
  return `${v.slice(0, 4)}\u2026${"*".repeat(4)} (${String(v.length)} chars)`;
}
function isReference(value) {
  return reference.test(value);
}
function findSecret(value) {
  for (const [kind, re] of tokenFormats) {
    const m = re.exec(value);
    if (m) return { kind, preview: mask(m[0]) };
  }
  const url = urlCredentials.exec(value);
  const devDefault = url?.[1] && url[2] && localHost.test(url[2]) && localDefaults.test(url[1]);
  if (url?.[1] && !isReference(url[1]) && !placeholder.test(url[1]) && !devDefault) {
    return { kind: "password in URL", preview: mask(url[1]) };
  }
  const assign = inlineAssignment.exec(value);
  const pointer = assign?.[1] !== void 0 && /(URL|URI|HOST|PATH|FILE|DIR|ENDPOINT|BASE)(_|$)/.test(assign[1]);
  if (assign?.[4] && !assign[4].startsWith("$") && !isReference(assign[4]) && !placeholder.test(assign[4]) && !pointer) {
    return { kind: `${assign[1] ?? "secret"} in a command`, preview: mask(assign[4]) };
  }
  return void 0;
}
function findNamedSecret(name, value) {
  const known = findSecret(value);
  if (known) return known;
  if (!secretName.test(name) || isReference(value)) return void 0;
  if (/(_PATH|_FILE|_DIR|_HELPER)$/i.test(name) || /^(~|\.{0,2}\/|[A-Za-z]:\\)/.test(value)) return void 0;
  const literal = value.replace(/^(Bearer|Basic|token)\s+/i, "").trim();
  if (literal.length < 8 || placeholder.test(literal) || /\s/.test(literal)) return void 0;
  return { kind: `literal value in ${name}`, preview: mask(literal) };
}

// src/types.ts
var severityRank = { high: 3, medium: 2, low: 1 };

// src/checks.ts
var checks = [
  {
    id: "AC001",
    severity: "high",
    title: "Hardcoded secret",
    description: "A token, password or key is written in the config instead of referenced from the environment."
  },
  {
    id: "AC002",
    severity: "medium",
    title: "Unpinned MCP package",
    description: "The server runs whatever version of the package is newest each time it starts (npx/bunx/uvx without an exact version)."
  },
  {
    id: "AC003",
    severity: "high",
    title: "MCP server over plain HTTP",
    description: "A remote MCP server is reached without TLS, so traffic and tokens can be read or changed on the way."
  },
  {
    id: "AC004",
    severity: "medium",
    title: "Broad filesystem access",
    description: "An MCP server is given the whole disk or home directory."
  },
  {
    id: "AC005",
    severity: "high",
    title: "Permission prompts bypassed",
    description: "Claude Code is set to run every tool without asking."
  },
  {
    id: "AC006",
    severity: "high",
    title: "Every shell command allowed",
    description: "A permission rule allows any Bash command without a prompt."
  },
  {
    id: "AC007",
    severity: "medium",
    title: "Project MCP servers auto-approved",
    description: "Every MCP server in a repository's .mcp.json is started without asking, including ones added by someone else."
  },
  {
    id: "AC008",
    severity: "high",
    title: "Container with host access",
    description: "An MCP server runs in a container that can reach the host (privileged, host root or Docker socket mounted)."
  },
  {
    id: "AC009",
    severity: "high",
    title: "Remote script piped to a shell",
    description: "A hook downloads a script and runs it, so whoever controls that URL runs code on every tool call."
  },
  {
    id: "AC010",
    severity: "low",
    title: "Secret input not masked",
    description: "A VS Code input for a secret is not marked password: true, so it is shown while typed."
  }
];
var runners = {
  npx: [],
  bunx: [],
  uvx: [],
  pnpm: ["dlx"],
  yarn: ["dlx"],
  pipx: ["run"]
};
function packageSpec(command, args) {
  const bin = command.split("/").pop() ?? command;
  const sub = runners[bin];
  if (!sub) return void 0;
  let rest = args;
  for (const s of sub) {
    if (rest[0] !== s) return void 0;
    rest = rest.slice(1);
  }
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i] ?? "";
    if (a === "-p" || a === "--package" || a === "--from") return rest[i + 1];
    if (a.startsWith("--package=") || a.startsWith("--from=")) return a.slice(a.indexOf("=") + 1);
    if (a.startsWith("-")) continue;
    return a;
  }
  return void 0;
}
function pinning(spec) {
  const py = /^[A-Za-z0-9_.-]+(\[[^\]]*\])?==\s*[\w.+-]+$/.test(spec);
  if (py) return "exact";
  const at = spec.lastIndexOf("@");
  if (at <= 0) return "none";
  const version2 = spec.slice(at + 1);
  if (/^v?\d+\.\d+\.\d+([-+][\w.-]+)?$/.test(version2)) return "exact";
  if (/^[\^~<>=*x\d]/.test(version2)) return "range";
  return "tag";
}
var localHosts = /^(localhost|127\.\d+\.\d+\.\d+|\[?::1\]?|0\.0\.0\.0|host\.docker\.internal)$/;
var broadPaths = /* @__PURE__ */ new Set(["/", "~", "~/", "$HOME", "${HOME}", "/Users", "/home", "C:\\", "C:/", "/root"]);
function audit(cfg) {
  const out = cfg.errors.map((e) => ({
    ruleId: "PARSE",
    severity: "low",
    target: cfg.file,
    file: cfg.file,
    line: e.line,
    message: `could not parse: ${e.message}`
  }));
  const add = (target, line, f) => out.push({ ...f, target, file: cfg.file, line });
  const secret = (target, where, loc, name) => {
    const m = name === void 0 ? findSecret(loc.value) : findNamedSecret(name, loc.value);
    if (!m) return;
    add(target, loc.line, {
      ruleId: "AC001",
      severity: "high",
      message: `${target}: ${m.kind} hardcoded in ${where} (${m.preview})`,
      help: cfg.shared ? "This file is usually committed: rotate the secret, then reference it from the environment (${VAR} / ${env:VAR} / ${input:id})." : "Reference it from the environment (${VAR} / ${env:VAR} / ${input:id}) or a credential helper instead of the file."
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
          help: 'Allow specific commands instead, e.g. "Bash(npm test *)", and keep a deny list for destructive ones.'
        });
      }
    }
    if (st.defaultMode?.value === "bypassPermissions") {
      add("settings", st.defaultMode.line, {
        ruleId: "AC005",
        severity: "high",
        message: 'permissions.defaultMode is "bypassPermissions": every tool runs without asking',
        help: 'Use "acceptEdits" or "auto", or set permissions.disableBypassPermissionsMode to "disable".'
      });
    }
    if (st.skipDangerousPrompt?.value === true) {
      add("settings", st.skipDangerousPrompt.line, {
        ruleId: "AC005",
        severity: "medium",
        message: "skipDangerousModePermissionPrompt is true: entering bypass mode no longer asks for confirmation"
      });
    }
    if (st.enableAllProjectMcpServers?.value === true) {
      add("settings", st.enableAllProjectMcpServers.line, {
        ruleId: "AC007",
        severity: "medium",
        message: "enableAllProjectMcpServers is true: any MCP server added to a repository's .mcp.json starts without asking",
        help: "List trusted servers in enabledMcpjsonServers instead."
      });
    }
    for (const c of st.hookCommands) {
      secret("hooks", "a hook command", c);
      if (/\b(curl|wget)\b[^|]*\|\s*(sudo\s+)?(ba|z|da)?sh\b/.test(c.value)) {
        add("hooks", c.line, {
          ruleId: "AC009",
          severity: "high",
          message: "a hook pipes a downloaded script into a shell",
          help: "Vendor the script into the repository (or pin it by checksum) and run the local copy."
        });
      }
    }
  }
  for (const input of cfg.plainInputs) {
    add(`input:${input.value}`, input.line, {
      ruleId: "AC010",
      severity: "low",
      message: `input "${input.value}" looks like a secret but is not marked password: true`
    });
  }
  return out.sort(
    (a, b) => severityRank[b.severity] - severityRank[a.severity] || a.line - b.line || a.ruleId.localeCompare(b.ruleId)
  );
}
function checkServer(s, add, secret) {
  const t = s.name;
  for (const [k, v] of Object.entries(s.env)) secret(t, `env.${k}`, v, k);
  for (const [k, v] of Object.entries(s.headers)) secret(t, `headers.${k}`, v, k);
  for (const a of s.args) secret(t, "args", a);
  if (s.command) secret(t, "command", s.command);
  if (s.url) secret(t, "url", s.url);
  if (s.command) {
    const args = s.args.map((a) => a.value);
    const spec = packageSpec(s.command.value, args);
    const p = spec === void 0 ? void 0 : pinning(spec);
    if (spec !== void 0 && p !== "exact") {
      add(t, s.command.line, {
        ruleId: "AC002",
        severity: p === "range" ? "low" : "medium",
        message: p === "range" ? `${t} runs ${spec}: a version range, so new releases start automatically` : `${t} runs ${spec} without a pinned version, so every start may fetch a newly published release`,
        help: `Pin an exact version (e.g. ${spec.replace(/@[^@/]*$/, "")}@1.2.3) and update it deliberately; hijacked releases are usually pulled within days.`
      });
    }
    const bin = s.command.value.split("/").pop();
    if (bin === "docker" || bin === "podman") {
      const joined = args.join(" ");
      if (/--privileged\b|(-v|--volume|--mount)[ =](\/|[^ ]*src=\/)(:| |,|$)|docker\.sock|--pid[ =]host|--network[ =]host/.test(
        joined
      )) {
        add(t, s.command.line, {
          ruleId: "AC008",
          severity: "high",
          message: `${t} runs a container that can reach the host`,
          help: "Drop --privileged, host namespaces and host mounts; mount only the directory the server needs, read-only if possible."
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
          help: "Use https:// (or wss://) for anything that leaves this machine."
        });
      }
    } catch {
    }
  }
  for (const a of s.args) {
    if (broadPaths.has(a.value.trim())) {
      add(t, a.line, {
        ruleId: "AC004",
        severity: "medium",
        message: `${t} is given access to ${a.value}`,
        help: "Pass only the project directories the server needs."
      });
    }
  }
}

// src/report.ts
var formats = ["text", "json", "markdown", "sarif"];
function counts(findings) {
  const c = { high: 0, medium: 0, low: 0 };
  for (const f of findings) c[f.severity]++;
  return c;
}
function summary(findings, files) {
  const c = counts(findings);
  return `${String(files)} file(s), ${String(findings.length)} finding(s): ${String(c.high)} high, ${String(c.medium)} medium, ${String(c.low)} low`;
}
function render(findings, format2, opts) {
  switch (format2) {
    case "json":
      return JSON.stringify({ findings, summary: counts(findings) }, null, 2) + "\n";
    case "markdown":
      return markdown(findings, opts.files);
    case "sarif":
      return JSON.stringify(sarif(findings, opts.rules, opts.version), null, 2) + "\n";
    case "text":
      return text(findings, opts.files);
  }
}
function text(findings, files) {
  const lines = findings.map((f) => {
    return `${f.file}:${String(f.line)}  ${f.severity.toUpperCase().padEnd(6)} ${f.ruleId}  ${f.message}`;
  });
  return [...lines, lines.length ? "" : "No problems found.", summary(findings, files), ""].join("\n");
}
function markdown(findings, files) {
  const icon = findings.some((f) => f.severity === "high") ? "\u{1F6D1}" : findings.length ? "\u26A0\uFE0F" : "\u2705";
  const out = [`### ${icon} agent-config-audit`, "", summary(findings, files), ""];
  if (findings.length) {
    out.push("| Severity | Check | Where | Problem | What to do |", "|---|---|---|---|---|");
    for (const f of findings) {
      const esc = (s) => (s ?? "").replaceAll("|", "\\|");
      out.push(`| ${f.severity} | ${f.ruleId} | \`${f.target}\` | ${esc(f.message)} | ${esc(f.help)} |`);
    }
  }
  return out.join("\n") + "\n";
}
var sarifLevel = { high: "error", medium: "warning", low: "note" };
var securitySeverity = { high: "8.0", medium: "5.0", low: "2.0" };
function sarif(findings, rules, version2) {
  return {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "agent-config-audit",
            version: version2,
            informationUri: "https://github.com/OTA-EITA/agent-config-audit",
            rules: rules.map((r) => ({
              id: r.id,
              name: r.title,
              shortDescription: { text: r.title },
              fullDescription: { text: r.description },
              defaultConfiguration: { level: sarifLevel[r.severity] },
              properties: {
                tags: ["security", "secrets", "mcp"],
                "security-severity": securitySeverity[r.severity]
              }
            }))
          }
        },
        results: findings.map((f) => ({
          ruleId: f.ruleId,
          level: sarifLevel[f.severity],
          message: { text: f.help ? `${f.message}. ${f.help}` : f.message },
          locations: [
            { physicalLocation: { artifactLocation: { uri: f.file }, region: { startLine: f.line } } }
          ]
        }))
      }
    ]
  };
}

// src/scan.ts
import { readdir, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

// node_modules/jsonc-parser/lib/esm/impl/scanner.js
function createScanner(text2, ignoreTrivia = false) {
  const len = text2.length;
  let pos = 0, value = "", tokenOffset = 0, token = 16, lineNumber = 0, lineStartOffset = 0, tokenLineStartOffset = 0, prevTokenLineStartOffset = 0, scanError = 0;
  function scanHexDigits(count, exact) {
    let digits = 0;
    let value2 = 0;
    while (digits < count || !exact) {
      let ch = text2.charCodeAt(pos);
      if (ch >= 48 && ch <= 57) {
        value2 = value2 * 16 + ch - 48;
      } else if (ch >= 65 && ch <= 70) {
        value2 = value2 * 16 + ch - 65 + 10;
      } else if (ch >= 97 && ch <= 102) {
        value2 = value2 * 16 + ch - 97 + 10;
      } else {
        break;
      }
      pos++;
      digits++;
    }
    if (digits < count) {
      value2 = -1;
    }
    return value2;
  }
  function setPosition(newPosition) {
    pos = newPosition;
    value = "";
    tokenOffset = 0;
    token = 16;
    scanError = 0;
  }
  function scanNumber() {
    let start = pos;
    if (text2.charCodeAt(pos) === 48) {
      pos++;
    } else {
      pos++;
      while (pos < text2.length && isDigit(text2.charCodeAt(pos))) {
        pos++;
      }
    }
    if (pos < text2.length && text2.charCodeAt(pos) === 46) {
      pos++;
      if (pos < text2.length && isDigit(text2.charCodeAt(pos))) {
        pos++;
        while (pos < text2.length && isDigit(text2.charCodeAt(pos))) {
          pos++;
        }
      } else {
        scanError = 3;
        return text2.substring(start, pos);
      }
    }
    let end = pos;
    if (pos < text2.length && (text2.charCodeAt(pos) === 69 || text2.charCodeAt(pos) === 101)) {
      pos++;
      if (pos < text2.length && text2.charCodeAt(pos) === 43 || text2.charCodeAt(pos) === 45) {
        pos++;
      }
      if (pos < text2.length && isDigit(text2.charCodeAt(pos))) {
        pos++;
        while (pos < text2.length && isDigit(text2.charCodeAt(pos))) {
          pos++;
        }
        end = pos;
      } else {
        scanError = 3;
      }
    }
    return text2.substring(start, end);
  }
  function scanString() {
    let result = "", start = pos;
    while (true) {
      if (pos >= len) {
        result += text2.substring(start, pos);
        scanError = 2;
        break;
      }
      const ch = text2.charCodeAt(pos);
      if (ch === 34) {
        result += text2.substring(start, pos);
        pos++;
        break;
      }
      if (ch === 92) {
        result += text2.substring(start, pos);
        pos++;
        if (pos >= len) {
          scanError = 2;
          break;
        }
        const ch2 = text2.charCodeAt(pos++);
        switch (ch2) {
          case 34:
            result += '"';
            break;
          case 92:
            result += "\\";
            break;
          case 47:
            result += "/";
            break;
          case 98:
            result += "\b";
            break;
          case 102:
            result += "\f";
            break;
          case 110:
            result += "\n";
            break;
          case 114:
            result += "\r";
            break;
          case 116:
            result += "	";
            break;
          case 117:
            const ch3 = scanHexDigits(4, true);
            if (ch3 >= 0) {
              result += String.fromCharCode(ch3);
            } else {
              scanError = 4;
            }
            break;
          default:
            scanError = 5;
        }
        start = pos;
        continue;
      }
      if (ch >= 0 && ch <= 31) {
        if (isLineBreak(ch)) {
          result += text2.substring(start, pos);
          scanError = 2;
          break;
        } else {
          scanError = 6;
        }
      }
      pos++;
    }
    return result;
  }
  function scanNext() {
    value = "";
    scanError = 0;
    tokenOffset = pos;
    lineStartOffset = lineNumber;
    prevTokenLineStartOffset = tokenLineStartOffset;
    if (pos >= len) {
      tokenOffset = len;
      return token = 17;
    }
    let code = text2.charCodeAt(pos);
    if (isWhiteSpace(code)) {
      do {
        pos++;
        value += String.fromCharCode(code);
        code = text2.charCodeAt(pos);
      } while (isWhiteSpace(code));
      return token = 15;
    }
    if (isLineBreak(code)) {
      pos++;
      value += String.fromCharCode(code);
      if (code === 13 && text2.charCodeAt(pos) === 10) {
        pos++;
        value += "\n";
      }
      lineNumber++;
      tokenLineStartOffset = pos;
      return token = 14;
    }
    switch (code) {
      // tokens: []{}:,
      case 123:
        pos++;
        return token = 1;
      case 125:
        pos++;
        return token = 2;
      case 91:
        pos++;
        return token = 3;
      case 93:
        pos++;
        return token = 4;
      case 58:
        pos++;
        return token = 6;
      case 44:
        pos++;
        return token = 5;
      // strings
      case 34:
        pos++;
        value = scanString();
        return token = 10;
      // comments
      case 47:
        const start = pos - 1;
        if (text2.charCodeAt(pos + 1) === 47) {
          pos += 2;
          while (pos < len) {
            if (isLineBreak(text2.charCodeAt(pos))) {
              break;
            }
            pos++;
          }
          value = text2.substring(start, pos);
          return token = 12;
        }
        if (text2.charCodeAt(pos + 1) === 42) {
          pos += 2;
          const safeLength = len - 1;
          let commentClosed = false;
          while (pos < safeLength) {
            const ch = text2.charCodeAt(pos);
            if (ch === 42 && text2.charCodeAt(pos + 1) === 47) {
              pos += 2;
              commentClosed = true;
              break;
            }
            pos++;
            if (isLineBreak(ch)) {
              if (ch === 13 && text2.charCodeAt(pos) === 10) {
                pos++;
              }
              lineNumber++;
              tokenLineStartOffset = pos;
            }
          }
          if (!commentClosed) {
            pos++;
            scanError = 1;
          }
          value = text2.substring(start, pos);
          return token = 13;
        }
        value += String.fromCharCode(code);
        pos++;
        return token = 16;
      // numbers
      case 45:
        value += String.fromCharCode(code);
        pos++;
        if (pos === len || !isDigit(text2.charCodeAt(pos))) {
          return token = 16;
        }
      // found a minus, followed by a number so
      // we fall through to proceed with scanning
      // numbers
      case 48:
      case 49:
      case 50:
      case 51:
      case 52:
      case 53:
      case 54:
      case 55:
      case 56:
      case 57:
        value += scanNumber();
        return token = 11;
      // literals and unknown symbols
      default:
        while (pos < len && isUnknownContentCharacter(code)) {
          pos++;
          code = text2.charCodeAt(pos);
        }
        if (tokenOffset !== pos) {
          value = text2.substring(tokenOffset, pos);
          switch (value) {
            case "true":
              return token = 8;
            case "false":
              return token = 9;
            case "null":
              return token = 7;
          }
          return token = 16;
        }
        value += String.fromCharCode(code);
        pos++;
        return token = 16;
    }
  }
  function isUnknownContentCharacter(code) {
    if (isWhiteSpace(code) || isLineBreak(code)) {
      return false;
    }
    switch (code) {
      case 125:
      case 93:
      case 123:
      case 91:
      case 34:
      case 58:
      case 44:
      case 47:
        return false;
    }
    return true;
  }
  function scanNextNonTrivia() {
    let result;
    do {
      result = scanNext();
    } while (result >= 12 && result <= 15);
    return result;
  }
  return {
    setPosition,
    getPosition: () => pos,
    scan: ignoreTrivia ? scanNextNonTrivia : scanNext,
    getToken: () => token,
    getTokenValue: () => value,
    getTokenOffset: () => tokenOffset,
    getTokenLength: () => pos - tokenOffset,
    getTokenStartLine: () => lineStartOffset,
    getTokenStartCharacter: () => tokenOffset - prevTokenLineStartOffset,
    getTokenError: () => scanError
  };
}
function isWhiteSpace(ch) {
  return ch === 32 || ch === 9;
}
function isLineBreak(ch) {
  return ch === 10 || ch === 13;
}
function isDigit(ch) {
  return ch >= 48 && ch <= 57;
}
var CharacterCodes;
(function(CharacterCodes2) {
  CharacterCodes2[CharacterCodes2["lineFeed"] = 10] = "lineFeed";
  CharacterCodes2[CharacterCodes2["carriageReturn"] = 13] = "carriageReturn";
  CharacterCodes2[CharacterCodes2["space"] = 32] = "space";
  CharacterCodes2[CharacterCodes2["_0"] = 48] = "_0";
  CharacterCodes2[CharacterCodes2["_1"] = 49] = "_1";
  CharacterCodes2[CharacterCodes2["_2"] = 50] = "_2";
  CharacterCodes2[CharacterCodes2["_3"] = 51] = "_3";
  CharacterCodes2[CharacterCodes2["_4"] = 52] = "_4";
  CharacterCodes2[CharacterCodes2["_5"] = 53] = "_5";
  CharacterCodes2[CharacterCodes2["_6"] = 54] = "_6";
  CharacterCodes2[CharacterCodes2["_7"] = 55] = "_7";
  CharacterCodes2[CharacterCodes2["_8"] = 56] = "_8";
  CharacterCodes2[CharacterCodes2["_9"] = 57] = "_9";
  CharacterCodes2[CharacterCodes2["a"] = 97] = "a";
  CharacterCodes2[CharacterCodes2["b"] = 98] = "b";
  CharacterCodes2[CharacterCodes2["c"] = 99] = "c";
  CharacterCodes2[CharacterCodes2["d"] = 100] = "d";
  CharacterCodes2[CharacterCodes2["e"] = 101] = "e";
  CharacterCodes2[CharacterCodes2["f"] = 102] = "f";
  CharacterCodes2[CharacterCodes2["g"] = 103] = "g";
  CharacterCodes2[CharacterCodes2["h"] = 104] = "h";
  CharacterCodes2[CharacterCodes2["i"] = 105] = "i";
  CharacterCodes2[CharacterCodes2["j"] = 106] = "j";
  CharacterCodes2[CharacterCodes2["k"] = 107] = "k";
  CharacterCodes2[CharacterCodes2["l"] = 108] = "l";
  CharacterCodes2[CharacterCodes2["m"] = 109] = "m";
  CharacterCodes2[CharacterCodes2["n"] = 110] = "n";
  CharacterCodes2[CharacterCodes2["o"] = 111] = "o";
  CharacterCodes2[CharacterCodes2["p"] = 112] = "p";
  CharacterCodes2[CharacterCodes2["q"] = 113] = "q";
  CharacterCodes2[CharacterCodes2["r"] = 114] = "r";
  CharacterCodes2[CharacterCodes2["s"] = 115] = "s";
  CharacterCodes2[CharacterCodes2["t"] = 116] = "t";
  CharacterCodes2[CharacterCodes2["u"] = 117] = "u";
  CharacterCodes2[CharacterCodes2["v"] = 118] = "v";
  CharacterCodes2[CharacterCodes2["w"] = 119] = "w";
  CharacterCodes2[CharacterCodes2["x"] = 120] = "x";
  CharacterCodes2[CharacterCodes2["y"] = 121] = "y";
  CharacterCodes2[CharacterCodes2["z"] = 122] = "z";
  CharacterCodes2[CharacterCodes2["A"] = 65] = "A";
  CharacterCodes2[CharacterCodes2["B"] = 66] = "B";
  CharacterCodes2[CharacterCodes2["C"] = 67] = "C";
  CharacterCodes2[CharacterCodes2["D"] = 68] = "D";
  CharacterCodes2[CharacterCodes2["E"] = 69] = "E";
  CharacterCodes2[CharacterCodes2["F"] = 70] = "F";
  CharacterCodes2[CharacterCodes2["G"] = 71] = "G";
  CharacterCodes2[CharacterCodes2["H"] = 72] = "H";
  CharacterCodes2[CharacterCodes2["I"] = 73] = "I";
  CharacterCodes2[CharacterCodes2["J"] = 74] = "J";
  CharacterCodes2[CharacterCodes2["K"] = 75] = "K";
  CharacterCodes2[CharacterCodes2["L"] = 76] = "L";
  CharacterCodes2[CharacterCodes2["M"] = 77] = "M";
  CharacterCodes2[CharacterCodes2["N"] = 78] = "N";
  CharacterCodes2[CharacterCodes2["O"] = 79] = "O";
  CharacterCodes2[CharacterCodes2["P"] = 80] = "P";
  CharacterCodes2[CharacterCodes2["Q"] = 81] = "Q";
  CharacterCodes2[CharacterCodes2["R"] = 82] = "R";
  CharacterCodes2[CharacterCodes2["S"] = 83] = "S";
  CharacterCodes2[CharacterCodes2["T"] = 84] = "T";
  CharacterCodes2[CharacterCodes2["U"] = 85] = "U";
  CharacterCodes2[CharacterCodes2["V"] = 86] = "V";
  CharacterCodes2[CharacterCodes2["W"] = 87] = "W";
  CharacterCodes2[CharacterCodes2["X"] = 88] = "X";
  CharacterCodes2[CharacterCodes2["Y"] = 89] = "Y";
  CharacterCodes2[CharacterCodes2["Z"] = 90] = "Z";
  CharacterCodes2[CharacterCodes2["asterisk"] = 42] = "asterisk";
  CharacterCodes2[CharacterCodes2["backslash"] = 92] = "backslash";
  CharacterCodes2[CharacterCodes2["closeBrace"] = 125] = "closeBrace";
  CharacterCodes2[CharacterCodes2["closeBracket"] = 93] = "closeBracket";
  CharacterCodes2[CharacterCodes2["colon"] = 58] = "colon";
  CharacterCodes2[CharacterCodes2["comma"] = 44] = "comma";
  CharacterCodes2[CharacterCodes2["dot"] = 46] = "dot";
  CharacterCodes2[CharacterCodes2["doubleQuote"] = 34] = "doubleQuote";
  CharacterCodes2[CharacterCodes2["minus"] = 45] = "minus";
  CharacterCodes2[CharacterCodes2["openBrace"] = 123] = "openBrace";
  CharacterCodes2[CharacterCodes2["openBracket"] = 91] = "openBracket";
  CharacterCodes2[CharacterCodes2["plus"] = 43] = "plus";
  CharacterCodes2[CharacterCodes2["slash"] = 47] = "slash";
  CharacterCodes2[CharacterCodes2["formFeed"] = 12] = "formFeed";
  CharacterCodes2[CharacterCodes2["tab"] = 9] = "tab";
})(CharacterCodes || (CharacterCodes = {}));

// node_modules/jsonc-parser/lib/esm/impl/string-intern.js
var cachedSpaces = new Array(20).fill(0).map((_, index) => {
  return " ".repeat(index);
});
var maxCachedValues = 200;
var cachedBreakLinesWithSpaces = {
  " ": {
    "\n": new Array(maxCachedValues).fill(0).map((_, index) => {
      return "\n" + " ".repeat(index);
    }),
    "\r": new Array(maxCachedValues).fill(0).map((_, index) => {
      return "\r" + " ".repeat(index);
    }),
    "\r\n": new Array(maxCachedValues).fill(0).map((_, index) => {
      return "\r\n" + " ".repeat(index);
    })
  },
  "	": {
    "\n": new Array(maxCachedValues).fill(0).map((_, index) => {
      return "\n" + "	".repeat(index);
    }),
    "\r": new Array(maxCachedValues).fill(0).map((_, index) => {
      return "\r" + "	".repeat(index);
    }),
    "\r\n": new Array(maxCachedValues).fill(0).map((_, index) => {
      return "\r\n" + "	".repeat(index);
    })
  }
};

// node_modules/jsonc-parser/lib/esm/impl/parser.js
var ParseOptions;
(function(ParseOptions2) {
  ParseOptions2.DEFAULT = {
    allowTrailingComma: false
  };
})(ParseOptions || (ParseOptions = {}));
function parseTree(text2, errors = [], options = ParseOptions.DEFAULT) {
  let currentParent = { type: "array", offset: -1, length: -1, children: [], parent: void 0 };
  function ensurePropertyComplete(endOffset) {
    if (currentParent.type === "property") {
      currentParent.length = endOffset - currentParent.offset;
      currentParent = currentParent.parent;
    }
  }
  function onValue(valueNode) {
    currentParent.children.push(valueNode);
    return valueNode;
  }
  const visitor = {
    onObjectBegin: (offset) => {
      currentParent = onValue({ type: "object", offset, length: -1, parent: currentParent, children: [] });
    },
    onObjectProperty: (name, offset, length) => {
      currentParent = onValue({ type: "property", offset, length: -1, parent: currentParent, children: [] });
      currentParent.children.push({ type: "string", value: name, offset, length, parent: currentParent });
    },
    onObjectEnd: (offset, length) => {
      ensurePropertyComplete(offset + length);
      currentParent.length = offset + length - currentParent.offset;
      currentParent = currentParent.parent;
      ensurePropertyComplete(offset + length);
    },
    onArrayBegin: (offset, length) => {
      currentParent = onValue({ type: "array", offset, length: -1, parent: currentParent, children: [] });
    },
    onArrayEnd: (offset, length) => {
      currentParent.length = offset + length - currentParent.offset;
      currentParent = currentParent.parent;
      ensurePropertyComplete(offset + length);
    },
    onLiteralValue: (value, offset, length) => {
      onValue({ type: getNodeType(value), offset, length, parent: currentParent, value });
      ensurePropertyComplete(offset + length);
    },
    onSeparator: (sep, offset, length) => {
      if (currentParent.type === "property") {
        if (sep === ":") {
          currentParent.colonOffset = offset;
        } else if (sep === ",") {
          ensurePropertyComplete(offset);
        }
      }
    },
    onError: (error, offset, length) => {
      errors.push({ error, offset, length });
    }
  };
  visit(text2, visitor, options);
  const result = currentParent.children[0];
  if (result) {
    delete result.parent;
  }
  return result;
}
function findNodeAtLocation(root, path2) {
  if (!root) {
    return void 0;
  }
  let node = root;
  for (let segment of path2) {
    if (typeof segment === "string") {
      if (node.type !== "object" || !Array.isArray(node.children)) {
        return void 0;
      }
      let found = false;
      for (const propertyNode of node.children) {
        if (Array.isArray(propertyNode.children) && propertyNode.children[0].value === segment && propertyNode.children.length === 2) {
          node = propertyNode.children[1];
          found = true;
          break;
        }
      }
      if (!found) {
        return void 0;
      }
    } else {
      const index = segment;
      if (node.type !== "array" || index < 0 || !Array.isArray(node.children) || index >= node.children.length) {
        return void 0;
      }
      node = node.children[index];
    }
  }
  return node;
}
function getNodeValue(node) {
  switch (node.type) {
    case "array":
      return node.children.map(getNodeValue);
    case "object":
      const obj = /* @__PURE__ */ Object.create(null);
      for (let prop of node.children) {
        const valueNode = prop.children[1];
        if (valueNode) {
          obj[prop.children[0].value] = getNodeValue(valueNode);
        }
      }
      return obj;
    case "null":
    case "string":
    case "number":
    case "boolean":
      return node.value;
    default:
      return void 0;
  }
}
function visit(text2, visitor, options = ParseOptions.DEFAULT) {
  const _scanner = createScanner(text2, false);
  const _jsonPath = [];
  let suppressedCallbacks = 0;
  function toNoArgVisit(visitFunction) {
    return visitFunction ? () => suppressedCallbacks === 0 && visitFunction(_scanner.getTokenOffset(), _scanner.getTokenLength(), _scanner.getTokenStartLine(), _scanner.getTokenStartCharacter()) : () => true;
  }
  function toOneArgVisit(visitFunction) {
    return visitFunction ? (arg) => suppressedCallbacks === 0 && visitFunction(arg, _scanner.getTokenOffset(), _scanner.getTokenLength(), _scanner.getTokenStartLine(), _scanner.getTokenStartCharacter()) : () => true;
  }
  function toOneArgVisitWithPath(visitFunction) {
    return visitFunction ? (arg) => suppressedCallbacks === 0 && visitFunction(arg, _scanner.getTokenOffset(), _scanner.getTokenLength(), _scanner.getTokenStartLine(), _scanner.getTokenStartCharacter(), () => _jsonPath.slice()) : () => true;
  }
  function toBeginVisit(visitFunction) {
    return visitFunction ? () => {
      if (suppressedCallbacks > 0) {
        suppressedCallbacks++;
      } else {
        let cbReturn = visitFunction(_scanner.getTokenOffset(), _scanner.getTokenLength(), _scanner.getTokenStartLine(), _scanner.getTokenStartCharacter(), () => _jsonPath.slice());
        if (cbReturn === false) {
          suppressedCallbacks = 1;
        }
      }
    } : () => true;
  }
  function toEndVisit(visitFunction) {
    return visitFunction ? () => {
      if (suppressedCallbacks > 0) {
        suppressedCallbacks--;
      }
      if (suppressedCallbacks === 0) {
        visitFunction(_scanner.getTokenOffset(), _scanner.getTokenLength(), _scanner.getTokenStartLine(), _scanner.getTokenStartCharacter());
      }
    } : () => true;
  }
  const onObjectBegin = toBeginVisit(visitor.onObjectBegin), onObjectProperty = toOneArgVisitWithPath(visitor.onObjectProperty), onObjectEnd = toEndVisit(visitor.onObjectEnd), onArrayBegin = toBeginVisit(visitor.onArrayBegin), onArrayEnd = toEndVisit(visitor.onArrayEnd), onLiteralValue = toOneArgVisitWithPath(visitor.onLiteralValue), onSeparator = toOneArgVisit(visitor.onSeparator), onComment = toNoArgVisit(visitor.onComment), onError = toOneArgVisit(visitor.onError);
  const disallowComments = options && options.disallowComments;
  const allowTrailingComma = options && options.allowTrailingComma;
  function scanNext() {
    while (true) {
      const token = _scanner.scan();
      switch (_scanner.getTokenError()) {
        case 4:
          handleError(
            14
            /* ParseErrorCode.InvalidUnicode */
          );
          break;
        case 5:
          handleError(
            15
            /* ParseErrorCode.InvalidEscapeCharacter */
          );
          break;
        case 3:
          handleError(
            13
            /* ParseErrorCode.UnexpectedEndOfNumber */
          );
          break;
        case 1:
          if (!disallowComments) {
            handleError(
              11
              /* ParseErrorCode.UnexpectedEndOfComment */
            );
          }
          break;
        case 2:
          handleError(
            12
            /* ParseErrorCode.UnexpectedEndOfString */
          );
          break;
        case 6:
          handleError(
            16
            /* ParseErrorCode.InvalidCharacter */
          );
          break;
      }
      switch (token) {
        case 12:
        case 13:
          if (disallowComments) {
            handleError(
              10
              /* ParseErrorCode.InvalidCommentToken */
            );
          } else {
            onComment();
          }
          break;
        case 16:
          handleError(
            1
            /* ParseErrorCode.InvalidSymbol */
          );
          break;
        case 15:
        case 14:
          break;
        default:
          return token;
      }
    }
  }
  function handleError(error, skipUntilAfter = [], skipUntil = []) {
    onError(error);
    if (skipUntilAfter.length + skipUntil.length > 0) {
      let token = _scanner.getToken();
      while (token !== 17) {
        if (skipUntilAfter.indexOf(token) !== -1) {
          scanNext();
          break;
        } else if (skipUntil.indexOf(token) !== -1) {
          break;
        }
        token = scanNext();
      }
    }
  }
  function parseString(isValue) {
    const value = _scanner.getTokenValue();
    if (isValue) {
      onLiteralValue(value);
    } else {
      onObjectProperty(value);
      _jsonPath.push(value);
    }
    scanNext();
    return true;
  }
  function parseLiteral() {
    switch (_scanner.getToken()) {
      case 11:
        const tokenValue = _scanner.getTokenValue();
        let value = Number(tokenValue);
        if (isNaN(value)) {
          handleError(
            2
            /* ParseErrorCode.InvalidNumberFormat */
          );
          value = 0;
        }
        onLiteralValue(value);
        break;
      case 7:
        onLiteralValue(null);
        break;
      case 8:
        onLiteralValue(true);
        break;
      case 9:
        onLiteralValue(false);
        break;
      default:
        return false;
    }
    scanNext();
    return true;
  }
  function parseProperty() {
    if (_scanner.getToken() !== 10) {
      handleError(3, [], [
        2,
        5
        /* SyntaxKind.CommaToken */
      ]);
      return false;
    }
    parseString(false);
    if (_scanner.getToken() === 6) {
      onSeparator(":");
      scanNext();
      if (!parseValue()) {
        handleError(4, [], [
          2,
          5
          /* SyntaxKind.CommaToken */
        ]);
      }
    } else {
      handleError(5, [], [
        2,
        5
        /* SyntaxKind.CommaToken */
      ]);
    }
    _jsonPath.pop();
    return true;
  }
  function parseObject() {
    onObjectBegin();
    scanNext();
    let needsComma = false;
    while (_scanner.getToken() !== 2 && _scanner.getToken() !== 17) {
      if (_scanner.getToken() === 5) {
        if (!needsComma) {
          handleError(4, [], []);
        }
        onSeparator(",");
        scanNext();
        if (_scanner.getToken() === 2 && allowTrailingComma) {
          break;
        }
      } else if (needsComma) {
        handleError(6, [], []);
      }
      if (!parseProperty()) {
        handleError(4, [], [
          2,
          5
          /* SyntaxKind.CommaToken */
        ]);
      }
      needsComma = true;
    }
    onObjectEnd();
    if (_scanner.getToken() !== 2) {
      handleError(7, [
        2
        /* SyntaxKind.CloseBraceToken */
      ], []);
    } else {
      scanNext();
    }
    return true;
  }
  function parseArray() {
    onArrayBegin();
    scanNext();
    let isFirstElement = true;
    let needsComma = false;
    while (_scanner.getToken() !== 4 && _scanner.getToken() !== 17) {
      if (_scanner.getToken() === 5) {
        if (!needsComma) {
          handleError(4, [], []);
        }
        onSeparator(",");
        scanNext();
        if (_scanner.getToken() === 4 && allowTrailingComma) {
          break;
        }
      } else if (needsComma) {
        handleError(6, [], []);
      }
      if (isFirstElement) {
        _jsonPath.push(0);
        isFirstElement = false;
      } else {
        _jsonPath[_jsonPath.length - 1]++;
      }
      if (!parseValue()) {
        handleError(4, [], [
          4,
          5
          /* SyntaxKind.CommaToken */
        ]);
      }
      needsComma = true;
    }
    onArrayEnd();
    if (!isFirstElement) {
      _jsonPath.pop();
    }
    if (_scanner.getToken() !== 4) {
      handleError(8, [
        4
        /* SyntaxKind.CloseBracketToken */
      ], []);
    } else {
      scanNext();
    }
    return true;
  }
  function parseValue() {
    switch (_scanner.getToken()) {
      case 3:
        return parseArray();
      case 1:
        return parseObject();
      case 10:
        return parseString(true);
      default:
        return parseLiteral();
    }
  }
  scanNext();
  if (_scanner.getToken() === 17) {
    if (options.allowEmptyContent) {
      return true;
    }
    handleError(4, [], []);
    return false;
  }
  if (!parseValue()) {
    handleError(4, [], []);
    return false;
  }
  if (_scanner.getToken() !== 17) {
    handleError(9, [], []);
  }
  return true;
}
function getNodeType(value) {
  switch (typeof value) {
    case "boolean":
      return "boolean";
    case "number":
      return "number";
    case "string":
      return "string";
    case "object": {
      if (!value) {
        return "null";
      } else if (Array.isArray(value)) {
        return "array";
      }
      return "object";
    }
    default:
      return "null";
  }
}

// node_modules/jsonc-parser/lib/esm/main.js
var ScanError;
(function(ScanError2) {
  ScanError2[ScanError2["None"] = 0] = "None";
  ScanError2[ScanError2["UnexpectedEndOfComment"] = 1] = "UnexpectedEndOfComment";
  ScanError2[ScanError2["UnexpectedEndOfString"] = 2] = "UnexpectedEndOfString";
  ScanError2[ScanError2["UnexpectedEndOfNumber"] = 3] = "UnexpectedEndOfNumber";
  ScanError2[ScanError2["InvalidUnicode"] = 4] = "InvalidUnicode";
  ScanError2[ScanError2["InvalidEscapeCharacter"] = 5] = "InvalidEscapeCharacter";
  ScanError2[ScanError2["InvalidCharacter"] = 6] = "InvalidCharacter";
})(ScanError || (ScanError = {}));
var SyntaxKind;
(function(SyntaxKind2) {
  SyntaxKind2[SyntaxKind2["OpenBraceToken"] = 1] = "OpenBraceToken";
  SyntaxKind2[SyntaxKind2["CloseBraceToken"] = 2] = "CloseBraceToken";
  SyntaxKind2[SyntaxKind2["OpenBracketToken"] = 3] = "OpenBracketToken";
  SyntaxKind2[SyntaxKind2["CloseBracketToken"] = 4] = "CloseBracketToken";
  SyntaxKind2[SyntaxKind2["CommaToken"] = 5] = "CommaToken";
  SyntaxKind2[SyntaxKind2["ColonToken"] = 6] = "ColonToken";
  SyntaxKind2[SyntaxKind2["NullKeyword"] = 7] = "NullKeyword";
  SyntaxKind2[SyntaxKind2["TrueKeyword"] = 8] = "TrueKeyword";
  SyntaxKind2[SyntaxKind2["FalseKeyword"] = 9] = "FalseKeyword";
  SyntaxKind2[SyntaxKind2["StringLiteral"] = 10] = "StringLiteral";
  SyntaxKind2[SyntaxKind2["NumericLiteral"] = 11] = "NumericLiteral";
  SyntaxKind2[SyntaxKind2["LineCommentTrivia"] = 12] = "LineCommentTrivia";
  SyntaxKind2[SyntaxKind2["BlockCommentTrivia"] = 13] = "BlockCommentTrivia";
  SyntaxKind2[SyntaxKind2["LineBreakTrivia"] = 14] = "LineBreakTrivia";
  SyntaxKind2[SyntaxKind2["Trivia"] = 15] = "Trivia";
  SyntaxKind2[SyntaxKind2["Unknown"] = 16] = "Unknown";
  SyntaxKind2[SyntaxKind2["EOF"] = 17] = "EOF";
})(SyntaxKind || (SyntaxKind = {}));
var parseTree2 = parseTree;
var findNodeAtLocation2 = findNodeAtLocation;
var getNodeValue2 = getNodeValue;
var ParseErrorCode;
(function(ParseErrorCode2) {
  ParseErrorCode2[ParseErrorCode2["InvalidSymbol"] = 1] = "InvalidSymbol";
  ParseErrorCode2[ParseErrorCode2["InvalidNumberFormat"] = 2] = "InvalidNumberFormat";
  ParseErrorCode2[ParseErrorCode2["PropertyNameExpected"] = 3] = "PropertyNameExpected";
  ParseErrorCode2[ParseErrorCode2["ValueExpected"] = 4] = "ValueExpected";
  ParseErrorCode2[ParseErrorCode2["ColonExpected"] = 5] = "ColonExpected";
  ParseErrorCode2[ParseErrorCode2["CommaExpected"] = 6] = "CommaExpected";
  ParseErrorCode2[ParseErrorCode2["CloseBraceExpected"] = 7] = "CloseBraceExpected";
  ParseErrorCode2[ParseErrorCode2["CloseBracketExpected"] = 8] = "CloseBracketExpected";
  ParseErrorCode2[ParseErrorCode2["EndOfFileExpected"] = 9] = "EndOfFileExpected";
  ParseErrorCode2[ParseErrorCode2["InvalidCommentToken"] = 10] = "InvalidCommentToken";
  ParseErrorCode2[ParseErrorCode2["UnexpectedEndOfComment"] = 11] = "UnexpectedEndOfComment";
  ParseErrorCode2[ParseErrorCode2["UnexpectedEndOfString"] = 12] = "UnexpectedEndOfString";
  ParseErrorCode2[ParseErrorCode2["UnexpectedEndOfNumber"] = 13] = "UnexpectedEndOfNumber";
  ParseErrorCode2[ParseErrorCode2["InvalidUnicode"] = 14] = "InvalidUnicode";
  ParseErrorCode2[ParseErrorCode2["InvalidEscapeCharacter"] = 15] = "InvalidEscapeCharacter";
  ParseErrorCode2[ParseErrorCode2["InvalidCharacter"] = 16] = "InvalidCharacter";
})(ParseErrorCode || (ParseErrorCode = {}));
function printParseErrorCode(code) {
  switch (code) {
    case 1:
      return "InvalidSymbol";
    case 2:
      return "InvalidNumberFormat";
    case 3:
      return "PropertyNameExpected";
    case 4:
      return "ValueExpected";
    case 5:
      return "ColonExpected";
    case 6:
      return "CommaExpected";
    case 7:
      return "CloseBraceExpected";
    case 8:
      return "CloseBracketExpected";
    case 9:
      return "EndOfFileExpected";
    case 10:
      return "InvalidCommentToken";
    case 11:
      return "UnexpectedEndOfComment";
    case 12:
      return "UnexpectedEndOfString";
    case 13:
      return "UnexpectedEndOfNumber";
    case 14:
      return "InvalidUnicode";
    case 15:
      return "InvalidEscapeCharacter";
    case 16:
      return "InvalidCharacter";
  }
  return "<unknown ParseErrorCode>";
}

// src/configs.ts
function kindOf(path2) {
  const p = path2.replaceAll("\\", "/");
  if (/(^|\/)\.claude\/settings(\.local)?\.json$/.test(p)) return "claude-settings";
  if (/(^|\/)\.claude\.json$/.test(p)) return "claude-json";
  if (/(^|\/)\.vscode\/mcp\.json$/.test(p)) return "vscode-mcp";
  if (/(^|\/)(\.mcp\.json|\.cursor\/mcp\.json|claude_desktop_config\.json)$/.test(p)) return "mcp";
  return void 0;
}
function lineCounter(text2) {
  const starts = [0];
  for (let i = 0; i < text2.length; i++) if (text2[i] === "\n") starts.push(i + 1);
  return (offset) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = lo + hi + 1 >> 1;
      if ((starts[mid] ?? 0) <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
}
function parseConfig(file, text2, kind) {
  const errors = [];
  const root = parseTree2(text2, errors, { allowTrailingComma: true, disallowComments: false });
  const lineAt = lineCounter(text2);
  const out = {
    file,
    kind,
    shared: !/settings\.local\.json$|(^|\/)\.claude\.json$|claude_desktop_config\.json$/.test(file) && !file.includes("/.cursor/mcp.json"),
    servers: [],
    plainInputs: [],
    errors: errors.map((e) => ({ line: lineAt(e.offset), message: printParseErrorCode(e.error) }))
  };
  if (root?.type !== "object") return out;
  const at = (node) => node ? lineAt(node.offset) : 1;
  const str = (node) => node?.type === "string" ? { value: node.value, line: at(node) } : void 0;
  const strMap = (node) => {
    const m = {};
    for (const prop of node?.type === "object" ? node.children ?? [] : []) {
      const [k, v] = prop.children ?? [];
      const s = str(v);
      if (k && s) m[String(k.value)] = s;
    }
    return m;
  };
  const readServers = (container) => {
    for (const prop of container?.type === "object" ? container.children ?? [] : []) {
      const [k, v] = prop.children ?? [];
      if (!k || v?.type !== "object") continue;
      const server = {
        name: String(k.value),
        line: at(k),
        args: (findNodeAtLocation2(v, ["args"])?.children ?? []).flatMap((a) => str(a) ?? []),
        env: strMap(findNodeAtLocation2(v, ["env"])),
        headers: strMap(findNodeAtLocation2(v, ["headers"]))
      };
      const type = getNodeValue2(
        findNodeAtLocation2(v, ["type"]) ?? { type: "null", offset: 0, length: 0 }
      );
      if (typeof type === "string") server.type = type;
      const command = str(findNodeAtLocation2(v, ["command"]));
      if (command) server.command = command;
      const url = str(findNodeAtLocation2(v, ["url"]));
      if (url) server.url = url;
      out.servers.push(server);
    }
  };
  if (kind === "vscode-mcp") {
    readServers(findNodeAtLocation2(root, ["servers"]));
    for (const input of findNodeAtLocation2(root, ["inputs"])?.children ?? []) {
      const id = findNodeAtLocation2(input, ["id"]);
      const password = findNodeAtLocation2(input, ["password"]);
      if (id?.type === "string" && /key|token|secret|pass/i.test(String(id.value)) && password?.value !== true) {
        out.plainInputs.push({ value: String(id.value), line: at(id) });
      }
    }
  } else {
    readServers(findNodeAtLocation2(root, ["mcpServers"]));
  }
  if (kind === "claude-json") {
    for (const project of findNodeAtLocation2(root, ["projects"])?.children ?? []) {
      readServers(findNodeAtLocation2(project.children?.[1] ?? project, ["mcpServers"]));
    }
  }
  if (kind === "claude-settings") {
    const bool = (path2) => {
      const n = findNodeAtLocation2(root, path2);
      return n?.type === "boolean" ? { value: n.value, line: at(n) } : void 0;
    };
    const settings = {
      allow: (findNodeAtLocation2(root, ["permissions", "allow"])?.children ?? []).flatMap(
        (a) => str(a) ?? []
      ),
      env: strMap(findNodeAtLocation2(root, ["env"])),
      hookCommands: []
    };
    const mode = str(findNodeAtLocation2(root, ["permissions", "defaultMode"]));
    if (mode) settings.defaultMode = mode;
    const skip = bool(["skipDangerousModePermissionPrompt"]);
    if (skip) settings.skipDangerousPrompt = skip;
    const all = bool(["enableAllProjectMcpServers"]);
    if (all) settings.enableAllProjectMcpServers = all;
    for (const event of findNodeAtLocation2(root, ["hooks"])?.children ?? []) {
      for (const group of event.children?.[1]?.children ?? []) {
        for (const hook of findNodeAtLocation2(group, ["hooks"])?.children ?? []) {
          const c = str(findNodeAtLocation2(hook, ["command"]));
          if (c) settings.hookCommands.push(c);
        }
      }
    }
    out.settings = settings;
  }
  return out;
}

// src/scan.ts
var skipDirs = /* @__PURE__ */ new Set(["node_modules", ".git", "dist", "vendor", ".venv"]);
function homeConfigs(home = homedir(), platform = process.platform, env = process.env) {
  const desktop = platform === "darwin" ? path.join(home, "Library/Application Support/Claude/claude_desktop_config.json") : platform === "win32" ? path.join(env.APPDATA ?? path.join(home, "AppData/Roaming"), "Claude/claude_desktop_config.json") : path.join(home, ".config/Claude/claude_desktop_config.json");
  return [
    path.join(home, ".claude/settings.json"),
    path.join(home, ".claude.json"),
    path.join(home, ".cursor/mcp.json"),
    desktop
  ];
}
async function findConfigs(root) {
  if ((await stat(root)).isFile()) return kindOf(root) ? [root] : [];
  const out = [];
  const walk = async (dir) => {
    const entries = (await readdir(dir, { withFileTypes: true })).sort(
      (a, b) => a.name.localeCompare(b.name)
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
async function scan(paths, cwd, home = []) {
  const result = { findings: [], files: 0, servers: 0 };
  const files = [...(await Promise.all(paths.map(findConfigs))).flat()];
  for (const h of home) {
    try {
      if ((await stat(h)).isFile()) files.push(h);
    } catch {
    }
  }
  for (const file of [...new Set(files)]) {
    const kind = kindOf(file);
    if (!kind) continue;
    const rel = path.isAbsolute(file) && !file.startsWith(cwd) ? file.replace(homedir(), "~") : path.relative(cwd, file) || file;
    const cfg = parseConfig(rel.split(path.sep).join("/"), await readFile(file, "utf8"), kind);
    result.files++;
    result.servers += cfg.servers.length;
    result.findings.push(...audit(cfg));
  }
  return result;
}

// src/cli.ts
var version = true ? "0.1.0" : "dev";
var usage = `usage: agent-config-audit [options] [path ...]

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
async function main(argv, io) {
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
        help: { type: "boolean", short: "h", default: false }
      }
    });
  } catch (err) {
    io.stderr(`error: ${err.message}

${usage}`);
    return 2;
  }
  const { values, positionals } = parsed;
  if (values.help) {
    io.stdout(usage);
    return 0;
  }
  if (values.version) {
    io.stdout(`agent-config-audit ${version}
`);
    return 0;
  }
  if (values["list-checks"]) {
    io.stdout(
      checks.map((c) => `${c.id}  ${c.severity.padEnd(6)}  ${c.title}: ${c.description}`).join("\n") + "\n"
    );
    return 0;
  }
  if (!formats.includes(values.format)) {
    io.stderr(`error: unknown format "${values.format}" (want ${formats.join(", ")})
`);
    return 2;
  }
  const failOn = values["fail-on"];
  if (failOn !== "none" && !(failOn in severityRank)) {
    io.stderr(`error: --fail-on must be high, medium, low or none, got "${failOn}"
`);
    return 2;
  }
  let result;
  try {
    const paths = positionals.length ? positionals : values.home ? [] : ["."];
    result = await scan(paths, io.cwd, values.home ? io.home() : []);
  } catch (err) {
    io.stderr(`error: ${err.message}
`);
    return 2;
  }
  if (result.files === 0) {
    io.stderr("error: no agent or MCP configuration found\n");
    return 2;
  }
  io.stdout(
    render(result.findings, values.format, { files: result.files, rules: checks, version })
  );
  if (failOn === "none") return 0;
  return result.findings.some((f) => severityRank[f.severity] >= severityRank[failOn]) ? 1 : 0;
}
function isEntryPoint(argv1, moduleUrl) {
  if (!argv1) return false;
  try {
    return realpathSync(argv1) === realpathSync(fileURLToPath(moduleUrl));
  } catch {
    return false;
  }
}
if (isEntryPoint(process.argv[1], import.meta.url)) {
  main(process.argv.slice(2), {
    stdout: (s) => process.stdout.write(s),
    stderr: (s) => process.stderr.write(s),
    cwd: process.cwd(),
    home: () => homeConfigs()
  }).then(
    (code) => {
      process.exitCode = code;
    },
    (err) => {
      process.stderr.write(`error: ${String(err)}
`);
      process.exitCode = 2;
    }
  );
}
export {
  isEntryPoint,
  main
};
