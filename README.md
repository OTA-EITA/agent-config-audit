# agent-config-audit

[![ci](https://github.com/OTA-EITA/agent-config-audit/actions/workflows/ci.yml/badge.svg)](https://github.com/OTA-EITA/agent-config-audit/actions/workflows/ci.yml)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/OTA-EITA/agent-config-audit/badge)](https://securityscorecards.dev/viewer/?uri=github.com/OTA-EITA/agent-config-audit)

**Your AI coding agent's config is probably holding secrets you never meant to write down.**

agent-config-audit scans the configuration of Claude Code, Cursor, VS Code and Claude Desktop — including every MCP server they start — for hardcoded tokens and passwords, MCP packages that update themselves on every start, remote servers without TLS, servers with access to your whole disk, and permission settings that let the agent run anything without asking.

```text
$ npx github:OTA-EITA/agent-config-audit test/fixtures/repo
test/fixtures/repo/.claude/settings.json:3  HIGH   AC005  permissions.defaultMode is "bypassPermissions": every tool runs without asking
test/fixtures/repo/.claude/settings.json:5  HIGH   AC006  permissions.allow has "Bash", so any shell command runs without a prompt
test/fixtures/repo/.claude/settings.json:6  HIGH   AC001  settings: PGPASSWORD in a command hardcoded in a permission rule (hunt…**** (14 chars))
test/fixtures/repo/.claude/settings.json:13  HIGH   AC009  a hook pipes a downloaded script into a shell
test/fixtures/repo/.mcp.json:5  HIGH   AC001  postgres: password in URL hardcoded in args (Sup3…**** (13 chars))
test/fixtures/repo/.mcp.json:14  HIGH   AC001  aws: AWS access key hardcoded in env.AWS_ACCESS_KEY_ID (AKIA…**** (20 chars))
test/fixtures/repo/.mcp.json:18  HIGH   AC003  remote connects to http://mcp.example.com without TLS
test/fixtures/repo/.mcp.json:22  HIGH   AC008  docker-tools runs a container that can reach the host
test/fixtures/repo/.mcp.json:4  MEDIUM AC002  postgres runs @modelcontextprotocol/server-postgres without a pinned version, so every start may fetch a newly published release
test/fixtures/repo/.mcp.json:9  MEDIUM AC004  filesystem is given access to /
…
4 file(s), 15 finding(s): 9 high, 4 medium, 2 low
```

Secrets are **never printed in full** — not in text, JSON, Markdown or SARIF output.

## How secrets end up there

Nobody types an API key into a settings file on purpose. It happens like this:

1. The agent runs `PGPASSWORD='…' psql -h db …` or `curl -H "Authorization: Bearer eyJ…"`.
2. You pick **"Yes, and don't ask again"**.
3. Claude Code saves that command as an allow rule in `.claude/settings.local.json` ([docs](https://code.claude.com/docs/en/permissions)) — password and all.

Claude Code keeps that file out of git when it creates it, so the credential usually isn't committed. But it now lives in plain text, outside your secret manager, in a file people copy into dotfiles repositories, paste to teammates ("send me your settings"), merge into the shared `.claude/settings.json`, and open on screen during demos. MCP configs are worse: `.mcp.json`, `.cursor/mcp.json` and `.vscode/mcp.json` are meant to be committed, and a token pasted into `env` or `headers` goes with them.

## Checks

| ID    | Severity | What it finds                                                                                                                                                                                                                     |
| ----- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC001 | high     | Hardcoded secrets: GitHub, Slack, AWS, Anthropic, OpenAI, Google, Stripe and npm tokens, private keys, passwords in URLs, `PASSWORD=`/`TOKEN=` in commands, and literal values under secret-sounding names in `env` and `headers` |
| AC002 | medium   | MCP servers started with `npx`/`bunx`/`uvx`/`pnpm dlx`/`pipx run` without an exact version (`@latest`, no version, or a range), so every start can pull a freshly hijacked release                                                |
| AC003 | high     | Remote MCP servers over `http://` or `ws://` (localhost is fine)                                                                                                                                                                  |
| AC004 | medium   | Filesystem access to `/`, `~` or the whole home directory                                                                                                                                                                         |
| AC005 | high     | Claude Code `defaultMode: "bypassPermissions"` or `skipDangerousModePermissionPrompt`                                                                                                                                             |
| AC006 | high     | `permissions.allow` with `Bash` or `Bash(*)`: every shell command without a prompt                                                                                                                                                |
| AC007 | medium   | `enableAllProjectMcpServers`: any server added to a repository's `.mcp.json` starts without asking                                                                                                                                |
| AC008 | high     | MCP servers in containers that can reach the host: `--privileged`, `/` mounted, the Docker socket, host network or PID namespace                                                                                                  |
| AC009 | high     | Hooks that pipe a downloaded script into a shell (`curl … \| sh`)                                                                                                                                                                 |
| AC010 | low      | VS Code `inputs` for secrets without `password: true`                                                                                                                                                                             |

It knows the safe way to reference secrets in each tool and does not flag them: `${VAR}` and `${VAR:-default}` (Claude Code), `${env:VAR}` (Cursor), `${input:id}` (VS Code), and `$VAR` in commands. Local development defaults such as `postgres://postgres:postgres@localhost` and paths to credential files are not reported.

## Files it reads

| Tool           | Files                                                                                                                                               |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude Code    | `.mcp.json`, `.claude/settings.json`, `.claude/settings.local.json`, `~/.claude/settings.json`, `~/.claude.json` (user and per-project MCP servers) |
| Cursor         | `.cursor/mcp.json`, `~/.cursor/mcp.json`                                                                                                            |
| VS Code        | `.vscode/mcp.json` (JSON with comments)                                                                                                             |
| Claude Desktop | `claude_desktop_config.json` (macOS and Windows locations)                                                                                          |

## Usage

```sh
npx github:OTA-EITA/agent-config-audit           # the current repository
npx github:OTA-EITA/agent-config-audit --home    # your personal configs too
npx github:OTA-EITA/agent-config-audit ~/code    # every project under a directory
```

| Option          |                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------- |
| `--home`        | Also read your personal configs (`~/.claude`, `~/.claude.json`, `~/.cursor`, Claude Desktop) |
| `--format`      | `text`, `json`, `markdown` or `sarif`                                                        |
| `--fail-on`     | Exit 1 on findings at least this severe (default `medium`)                                   |
| `--list-checks` | Print the checks                                                                             |

### In CI, for the configs a repository commits

```yaml
permissions:
  contents: read
  security-events: write
steps:
  - uses: actions/checkout@v5
    with:
      persist-credentials: false
  - uses: OTA-EITA/agent-config-audit@v0.1.0 # pin to a commit SHA in real use
    id: audit
  - uses: github/codeql-action/upload-sarif@v4
    if: always()
    with:
      sarif_file: ${{ steps.audit.outputs.sarif-file }}
      category: agent-config-audit
```

## When it finds a secret

1. **Rotate it first.** Assume anything that sat in plain text has been copied somewhere.
2. Move it to the environment or a credential helper and reference it: `${DB_PASSWORD}` in `.mcp.json`, `${env:DB_PASSWORD}` in Cursor, an `input` with `password: true` in VS Code.
3. Replace the saved permission rule with a pattern that has no secret in it, e.g. `Bash(psql -h db *)`, and keep the password in `PGPASSWORD` in your shell or in `~/.pgpass`.

## Development

```sh
npm ci --ignore-scripts
npm run coverage
npm run lint
npm run build   # commit dist/ after changing src/
```

Dependencies are locked to versions published at least 7 days ago and checked in CI with [lockfile-guard](https://github.com/OTA-EITA/lockfile-guard); workflows are pinned and checked with [gha-guard](https://github.com/OTA-EITA/gha-guard). Test fixtures only contain AWS's documented example key and made-up passwords; token-shaped test strings are built at runtime.

## License

MIT
