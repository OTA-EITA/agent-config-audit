import { findNodeAtLocation, getNodeValue, parseTree, printParseErrorCode } from "jsonc-parser";
import type { Node, ParseError } from "jsonc-parser";

export type ConfigKind = "claude-settings" | "claude-json" | "mcp" | "vscode-mcp";

export interface Located<T> {
  value: T;
  line: number;
}

export interface McpServer {
  name: string;
  line: number;
  type?: string;
  command?: Located<string>;
  args: Located<string>[];
  env: Record<string, Located<string>>;
  url?: Located<string>;
  headers: Record<string, Located<string>>;
}

export interface ClaudeSettings {
  defaultMode?: Located<string>;
  allow: Located<string>[];
  skipDangerousPrompt?: Located<boolean>;
  enableAllProjectMcpServers?: Located<boolean>;
  env: Record<string, Located<string>>;
  hookCommands: Located<string>[];
}

export interface ConfigFile {
  file: string;
  kind: ConfigKind;
  /** Shared with the team (committed) rather than personal. */
  shared: boolean;
  servers: McpServer[];
  settings?: ClaudeSettings;
  /** VS Code inputs that hold secrets without password masking. */
  plainInputs: Located<string>[];
  errors: { line: number; message: string }[];
}

/** Recognises a config file by its path, or returns undefined. */
export function kindOf(path: string): ConfigKind | undefined {
  const p = path.replaceAll("\\", "/");
  if (/(^|\/)\.claude\/settings(\.local)?\.json$/.test(p)) return "claude-settings";
  if (/(^|\/)\.claude\.json$/.test(p)) return "claude-json";
  if (/(^|\/)\.vscode\/mcp\.json$/.test(p)) return "vscode-mcp";
  if (/(^|\/)(\.mcp\.json|\.cursor\/mcp\.json|claude_desktop_config\.json)$/.test(p)) return "mcp";
  return undefined;
}

function lineCounter(text: string) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === "\n") starts.push(i + 1);
  return (offset: number) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if ((starts[mid] ?? 0) <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
}

export function parseConfig(file: string, text: string, kind: ConfigKind): ConfigFile {
  const errors: ParseError[] = [];
  const root = parseTree(text, errors, { allowTrailingComma: true, disallowComments: false });
  const lineAt = lineCounter(text);
  const out: ConfigFile = {
    file,
    kind,
    shared:
      !/settings\.local\.json$|(^|\/)\.claude\.json$|claude_desktop_config\.json$/.test(file) &&
      !file.includes("/.cursor/mcp.json"),
    servers: [],
    plainInputs: [],
    errors: errors.map((e) => ({ line: lineAt(e.offset), message: printParseErrorCode(e.error) })),
  };
  if (root?.type !== "object") return out;

  const at = (node: Node | undefined) => (node ? lineAt(node.offset) : 1);
  const str = (node: Node | undefined): Located<string> | undefined =>
    node?.type === "string" ? { value: node.value as string, line: at(node) } : undefined;
  const strMap = (node: Node | undefined) => {
    const m: Record<string, Located<string>> = {};
    for (const prop of node?.type === "object" ? (node.children ?? []) : []) {
      const [k, v] = prop.children ?? [];
      const s = str(v);
      if (k && s) m[String(k.value)] = s;
    }
    return m;
  };

  const readServers = (container: Node | undefined) => {
    for (const prop of container?.type === "object" ? (container.children ?? []) : []) {
      const [k, v] = prop.children ?? [];
      if (!k || v?.type !== "object") continue;
      const server: McpServer = {
        name: String(k.value),
        line: at(k),
        args: (findNodeAtLocation(v, ["args"])?.children ?? []).flatMap((a) => str(a) ?? []),
        env: strMap(findNodeAtLocation(v, ["env"])),
        headers: strMap(findNodeAtLocation(v, ["headers"])),
      };
      const type = getNodeValue(
        findNodeAtLocation(v, ["type"]) ?? { type: "null", offset: 0, length: 0 },
      ) as unknown;
      if (typeof type === "string") server.type = type;
      const command = str(findNodeAtLocation(v, ["command"]));
      if (command) server.command = command;
      const url = str(findNodeAtLocation(v, ["url"]));
      if (url) server.url = url;
      out.servers.push(server);
    }
  };

  if (kind === "vscode-mcp") {
    readServers(findNodeAtLocation(root, ["servers"]));
    for (const input of findNodeAtLocation(root, ["inputs"])?.children ?? []) {
      const id = findNodeAtLocation(input, ["id"]);
      const password = findNodeAtLocation(input, ["password"]);
      if (
        id?.type === "string" &&
        /key|token|secret|pass/i.test(String(id.value)) &&
        password?.value !== true
      ) {
        out.plainInputs.push({ value: String(id.value), line: at(id) });
      }
    }
  } else {
    readServers(findNodeAtLocation(root, ["mcpServers"]));
  }
  if (kind === "claude-json") {
    // ~/.claude.json also keeps local-scope servers per project.
    for (const project of findNodeAtLocation(root, ["projects"])?.children ?? []) {
      readServers(findNodeAtLocation(project.children?.[1] ?? project, ["mcpServers"]));
    }
  }

  if (kind === "claude-settings") {
    const bool = (path: string[]): Located<boolean> | undefined => {
      const n = findNodeAtLocation(root, path);
      return n?.type === "boolean" ? { value: n.value as boolean, line: at(n) } : undefined;
    };
    const settings: ClaudeSettings = {
      allow: (findNodeAtLocation(root, ["permissions", "allow"])?.children ?? []).flatMap(
        (a) => str(a) ?? [],
      ),
      env: strMap(findNodeAtLocation(root, ["env"])),
      hookCommands: [],
    };
    const mode = str(findNodeAtLocation(root, ["permissions", "defaultMode"]));
    if (mode) settings.defaultMode = mode;
    const skip = bool(["skipDangerousModePermissionPrompt"]);
    if (skip) settings.skipDangerousPrompt = skip;
    const all = bool(["enableAllProjectMcpServers"]);
    if (all) settings.enableAllProjectMcpServers = all;
    // hooks: { Event: [ { matcher, hooks: [ { type: "command", command } ] } ] }
    for (const event of findNodeAtLocation(root, ["hooks"])?.children ?? []) {
      for (const group of event.children?.[1]?.children ?? []) {
        for (const hook of findNodeAtLocation(group, ["hooks"])?.children ?? []) {
          const c = str(findNodeAtLocation(hook, ["command"]));
          if (c) settings.hookCommands.push(c);
        }
      }
    }
    out.settings = settings;
  }
  return out;
}
