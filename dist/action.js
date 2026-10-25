import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function __require2() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/jsonc-parser/lib/umd/main.js
var require_main = __commonJS({
  "node_modules/jsonc-parser/lib/umd/main.js"(exports, module) {
    (function(factory) {
      if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(__require, exports);
        if (v !== void 0) module.exports = v;
      } else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "./impl/format", "./impl/edit", "./impl/scanner", "./impl/parser"], factory);
      }
    })(function(require2, exports2) {
      "use strict";
      Object.defineProperty(exports2, "__esModule", { value: true });
      exports2.applyEdits = exports2.modify = exports2.format = exports2.printParseErrorCode = exports2.ParseErrorCode = exports2.stripComments = exports2.visit = exports2.getNodeValue = exports2.getNodePath = exports2.findNodeAtOffset = exports2.findNodeAtLocation = exports2.parseTree = exports2.parse = exports2.getLocation = exports2.SyntaxKind = exports2.ScanError = exports2.createScanner = void 0;
      const formatter = require2("./impl/format");
      const edit = require2("./impl/edit");
      const scanner = require2("./impl/scanner");
      const parser = require2("./impl/parser");
      exports2.createScanner = scanner.createScanner;
      var ScanError;
      (function(ScanError2) {
        ScanError2[ScanError2["None"] = 0] = "None";
        ScanError2[ScanError2["UnexpectedEndOfComment"] = 1] = "UnexpectedEndOfComment";
        ScanError2[ScanError2["UnexpectedEndOfString"] = 2] = "UnexpectedEndOfString";
        ScanError2[ScanError2["UnexpectedEndOfNumber"] = 3] = "UnexpectedEndOfNumber";
        ScanError2[ScanError2["InvalidUnicode"] = 4] = "InvalidUnicode";
        ScanError2[ScanError2["InvalidEscapeCharacter"] = 5] = "InvalidEscapeCharacter";
        ScanError2[ScanError2["InvalidCharacter"] = 6] = "InvalidCharacter";
      })(ScanError || (exports2.ScanError = ScanError = {}));
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
      })(SyntaxKind || (exports2.SyntaxKind = SyntaxKind = {}));
      exports2.getLocation = parser.getLocation;
      exports2.parse = parser.parse;
      exports2.parseTree = parser.parseTree;
      exports2.findNodeAtLocation = parser.findNodeAtLocation;
      exports2.findNodeAtOffset = parser.findNodeAtOffset;
      exports2.getNodePath = parser.getNodePath;
      exports2.getNodeValue = parser.getNodeValue;
      exports2.visit = parser.visit;
      exports2.stripComments = parser.stripComments;
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
      })(ParseErrorCode || (exports2.ParseErrorCode = ParseErrorCode = {}));
      function printParseErrorCode2(code) {
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
      exports2.printParseErrorCode = printParseErrorCode2;
      function format(documentText, range, options) {
        return formatter.format(documentText, range, options);
      }
      exports2.format = format;
      function modify(text2, path2, value, options) {
        return edit.setProperty(text2, path2, value, options);
      }
      exports2.modify = modify;
      function applyEdits(text2, edits) {
        let sortedEdits = edits.slice(0).sort((a, b) => {
          const diff = a.offset - b.offset;
          if (diff === 0) {
            return a.length - b.length;
          }
          return diff;
        });
        let lastModifiedOffset = text2.length;
        for (let i = sortedEdits.length - 1; i >= 0; i--) {
          let e = sortedEdits[i];
          if (e.offset + e.length <= lastModifiedOffset) {
            text2 = edit.applyEdit(text2, e);
          } else {
            throw new Error("Overlapping edit");
          }
          lastModifiedOffset = e.offset;
        }
        return text2;
      }
      exports2.applyEdits = applyEdits;
    });
  }
});

// src/action.ts
import { appendFileSync, writeFileSync } from "node:fs";

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
  for (const input2 of cfg.plainInputs) {
    add(`input:${input2.value}`, input2.line, {
      ruleId: "AC010",
      severity: "low",
      message: `input "${input2.value}" looks like a secret but is not marked password: true`
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
function counts(findings) {
  const c = { high: 0, medium: 0, low: 0 };
  for (const f of findings) c[f.severity]++;
  return c;
}
function summary(findings, files) {
  const c = counts(findings);
  return `${String(files)} file(s), ${String(findings.length)} finding(s): ${String(c.high)} high, ${String(c.medium)} medium, ${String(c.low)} low`;
}
function render(findings, format, opts) {
  switch (format) {
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

// src/configs.ts
var import_jsonc_parser = __toESM(require_main(), 1);
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
  const root = (0, import_jsonc_parser.parseTree)(text2, errors, { allowTrailingComma: true, disallowComments: false });
  const lineAt = lineCounter(text2);
  const out = {
    file,
    kind,
    shared: !/settings\.local\.json$|(^|\/)\.claude\.json$|claude_desktop_config\.json$/.test(file) && !file.includes("/.cursor/mcp.json"),
    servers: [],
    plainInputs: [],
    errors: errors.map((e) => ({ line: lineAt(e.offset), message: (0, import_jsonc_parser.printParseErrorCode)(e.error) }))
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
        args: ((0, import_jsonc_parser.findNodeAtLocation)(v, ["args"])?.children ?? []).flatMap((a) => str(a) ?? []),
        env: strMap((0, import_jsonc_parser.findNodeAtLocation)(v, ["env"])),
        headers: strMap((0, import_jsonc_parser.findNodeAtLocation)(v, ["headers"]))
      };
      const type = (0, import_jsonc_parser.getNodeValue)(
        (0, import_jsonc_parser.findNodeAtLocation)(v, ["type"]) ?? { type: "null", offset: 0, length: 0 }
      );
      if (typeof type === "string") server.type = type;
      const command = str((0, import_jsonc_parser.findNodeAtLocation)(v, ["command"]));
      if (command) server.command = command;
      const url = str((0, import_jsonc_parser.findNodeAtLocation)(v, ["url"]));
      if (url) server.url = url;
      out.servers.push(server);
    }
  };
  if (kind === "vscode-mcp") {
    readServers((0, import_jsonc_parser.findNodeAtLocation)(root, ["servers"]));
    for (const input2 of (0, import_jsonc_parser.findNodeAtLocation)(root, ["inputs"])?.children ?? []) {
      const id = (0, import_jsonc_parser.findNodeAtLocation)(input2, ["id"]);
      const password = (0, import_jsonc_parser.findNodeAtLocation)(input2, ["password"]);
      if (id?.type === "string" && /key|token|secret|pass/i.test(String(id.value)) && password?.value !== true) {
        out.plainInputs.push({ value: String(id.value), line: at(id) });
      }
    }
  } else {
    readServers((0, import_jsonc_parser.findNodeAtLocation)(root, ["mcpServers"]));
  }
  if (kind === "claude-json") {
    for (const project of (0, import_jsonc_parser.findNodeAtLocation)(root, ["projects"])?.children ?? []) {
      readServers((0, import_jsonc_parser.findNodeAtLocation)(project.children?.[1] ?? project, ["mcpServers"]));
    }
  }
  if (kind === "claude-settings") {
    const bool = (path2) => {
      const n = (0, import_jsonc_parser.findNodeAtLocation)(root, path2);
      return n?.type === "boolean" ? { value: n.value, line: at(n) } : void 0;
    };
    const settings = {
      allow: ((0, import_jsonc_parser.findNodeAtLocation)(root, ["permissions", "allow"])?.children ?? []).flatMap(
        (a) => str(a) ?? []
      ),
      env: strMap((0, import_jsonc_parser.findNodeAtLocation)(root, ["env"])),
      hookCommands: []
    };
    const mode = str((0, import_jsonc_parser.findNodeAtLocation)(root, ["permissions", "defaultMode"]));
    if (mode) settings.defaultMode = mode;
    const skip = bool(["skipDangerousModePermissionPrompt"]);
    if (skip) settings.skipDangerousPrompt = skip;
    const all = bool(["enableAllProjectMcpServers"]);
    if (all) settings.enableAllProjectMcpServers = all;
    for (const event of (0, import_jsonc_parser.findNodeAtLocation)(root, ["hooks"])?.children ?? []) {
      for (const group of event.children?.[1]?.children ?? []) {
        for (const hook of (0, import_jsonc_parser.findNodeAtLocation)(group, ["hooks"])?.children ?? []) {
          const c = str((0, import_jsonc_parser.findNodeAtLocation)(hook, ["command"]));
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

// src/action.ts
var version = true ? "0.1.0" : "dev";
function input(name, fallback) {
  const v = process.env[`INPUT_${name.toUpperCase()}`];
  return v === void 0 || v.trim() === "" ? fallback : v.trim();
}
var escapeData = (s) => s.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
var escapeProperty = (s) => escapeData(s).replaceAll(":", "%3A").replaceAll(",", "%2C");
async function run() {
  const failOn = input("fail-on", "high");
  if (failOn !== "none" && !(failOn in severityRank)) {
    throw new Error(`fail-on must be high, medium, low or none, got "${failOn}"`);
  }
  const sarifFile = input("sarif-file", "agent-config-audit.sarif");
  const result = await scan(input("path", ".").split(/\s+/), process.cwd());
  const opts = { files: result.files, rules: checks, version };
  writeFileSync(sarifFile, render(result.findings, "sarif", opts));
  const summary2 = process.env.GITHUB_STEP_SUMMARY;
  if (summary2) appendFileSync(summary2, render(result.findings, "markdown", opts));
  const output = process.env.GITHUB_OUTPUT;
  if (output) appendFileSync(output, `sarif-file=${sarifFile}
findings=${String(result.findings.length)}
`);
  for (const f of result.findings) {
    const level = f.severity === "high" ? "error" : f.severity === "medium" ? "warning" : "notice";
    process.stdout.write(
      `::${level} file=${escapeProperty(f.file)},line=${String(f.line)},title=${f.ruleId}::${escapeData(f.message)}
`
    );
  }
  if (failOn !== "none" && result.findings.some((f) => severityRank[f.severity] >= severityRank[failOn])) {
    process.exitCode = 1;
  }
}
run().catch((err) => {
  process.stdout.write(`::error::${escapeData(String(err))}
`);
  process.exitCode = 1;
});
