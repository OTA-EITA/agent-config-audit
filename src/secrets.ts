// Detects credentials written literally into agent configuration. Values are
// never returned in full: callers get a kind and a masked preview.

/** Variable references each tool expands at runtime: ${VAR}, ${VAR:-x}, ${env:VAR}, ${input:id}. */
const reference = /\$\{(env:|input:)?[A-Za-z_][A-Za-z0-9_.-]*(:-[^}]*)?\}/;

/** Obvious placeholders people leave in examples. */
const placeholder =
  /^(<[^>]*>|\[[^\]]*\]|your[_-]?\w*|x{3,}|\*{3,}|changeme|placeholder|example|dummy|test|none|null|todo|\.\.\.)$/i;

const tokenFormats: [string, RegExp][] = [
  ["GitHub token", /\b(gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})\b/],
  ["Slack token", /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ["AWS access key", /\b(AKIA|ASIA)[A-Z0-9]{16}\b/],
  ["Anthropic API key", /\bsk-ant-[A-Za-z0-9_-]{20,}/],
  ["OpenAI API key", /\bsk-(proj-)?[A-Za-z0-9_-]{32,}/],
  ["Google API key", /\bAIza[A-Za-z0-9_-]{35}\b/],
  ["Stripe secret key", /\b[rs]k_live_[A-Za-z0-9]{20,}/],
  ["npm token", /\bnpm_[A-Za-z0-9]{36}\b/],
  ["private key", /-----BEGIN (RSA |EC |OPENSSH |DSA |)PRIVATE KEY-----/],
];

/** NAME=value in a command line, e.g. PGPASSWORD='...' psql. */
const inlineAssignment =
  /\b([A-Z0-9_]*(PASSWORD|PASSWD|SECRET|TOKEN|API_?KEY|ACCESS_KEY)[A-Z0-9_]*)=(['"]?)([^\s'"]{6,})\3/;
/** scheme://user:password@host */
const urlCredentials = /\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:([^\s@/]{3,})@([^\s/:?]+)/i;
/** Well-known defaults that only make sense against a local development database. */
const localDefaults = /^(postgres|password|pass|root|admin|mysql|secret|test|dev|example)$/i;
const localHost = /^(localhost|127\.\d+\.\d+\.\d+|\[?::1\]?|0\.0\.0\.0|host\.docker\.internal)$/i;
/** Field names whose values are secrets. */
export const secretName =
  /(token|secret|passw(or)?d|api[_-]?key|access[_-]?key|private[_-]?key|credential|auth(orization)?|cookie|session)/i;

export interface SecretMatch {
  kind: string;
  /** Masked preview, safe to print. */
  preview: string;
}

export function mask(value: string): string {
  const v = value.trim();
  if (v.length <= 8) return `${"*".repeat(v.length)} (${String(v.length)} chars)`;
  return `${v.slice(0, 4)}…${"*".repeat(4)} (${String(v.length)} chars)`;
}

export function isReference(value: string): boolean {
  return reference.test(value);
}

/** Looks for a credential inside any string (command, argument, URL, rule). */
export function findSecret(value: string): SecretMatch | undefined {
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
  // TOKEN_URL_BASE, SECRET_FILE and the like name where a secret lives, not the secret.
  const pointer =
    assign?.[1] !== undefined && /(URL|URI|HOST|PATH|FILE|DIR|ENDPOINT|BASE)(_|$)/.test(assign[1]);
  // "$NAME" is the shell expanding a variable, not a literal.
  if (
    assign?.[4] &&
    !assign[4].startsWith("$") &&
    !isReference(assign[4]) &&
    !placeholder.test(assign[4]) &&
    !pointer
  ) {
    return { kind: `${assign[1] ?? "secret"} in a command`, preview: mask(assign[4]) };
  }
  return undefined;
}

/**
 * Checks a named value such as an env variable or header. Besides known formats,
 * any literal value under a secret-sounding name counts.
 */
export function findNamedSecret(name: string, value: string): SecretMatch | undefined {
  const known = findSecret(value);
  if (known) return known;
  if (!secretName.test(name) || isReference(value)) return undefined;
  // Paths to credential files (GOOGLE_APPLICATION_CREDENTIALS, *_PATH, *_FILE) are not secrets themselves.
  if (/(_PATH|_FILE|_DIR|_HELPER)$/i.test(name) || /^(~|\.{0,2}\/|[A-Za-z]:\\)/.test(value)) return undefined;
  const literal = value.replace(/^(Bearer|Basic|token)\s+/i, "").trim();
  if (literal.length < 8 || placeholder.test(literal) || /\s/.test(literal)) return undefined;
  return { kind: `literal value in ${name}`, preview: mask(literal) };
}
