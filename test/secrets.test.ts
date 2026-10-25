import { describe, expect, it } from "vitest";
import { findNamedSecret, findSecret, isReference, mask } from "../src/secrets.js";

// Token-shaped strings are assembled at runtime so no realistic token sits in the repository.
const tok = (prefix: string, n: number, ch = "a") => prefix + ch.repeat(n);

describe("mask", () => {
  it("never shows more than four characters", () => {
    expect(mask("supersecretvalue")).toBe("supe…**** (16 chars)");
    expect(mask("short")).toBe("***** (5 chars)");
  });
});

describe("isReference", () => {
  it.each(["${TOKEN}", "${TOKEN:-}", "Bearer ${env:GH_TOKEN}", "${input:api-key}"])("%s", (v) => {
    expect(isReference(v)).toBe(true);
  });
  it("is false for literals", () => {
    expect(isReference("$TOKEN")).toBe(false);
  });
});

describe("findSecret", () => {
  it.each([
    [tok("ghp_", 36), "GitHub token"],
    [tok("github_pat_", 70), "GitHub token"],
    [tok("xoxb-", 20, "1"), "Slack token"],
    ["AKIAIOSFODNN7EXAMPLE", "AWS access key"],
    [tok("sk-ant-api03-", 30), "Anthropic API key"],
    [tok("sk-proj-", 40), "OpenAI API key"],
    [tok("AIza", 35), "Google API key"],
    [tok("sk_live_", 24), "Stripe secret key"],
    [tok("npm_", 36), "npm token"],
    ["-----BEGIN OPENSSH PRIVATE KEY-----", "private key"],
  ])("recognises %s", (value, kind) => {
    expect(findSecret(`x ${value} y`)?.kind).toBe(kind);
  });

  it("finds passwords in URLs, except local defaults and references", () => {
    expect(findSecret("postgres://app:S3cr3tPw@db.internal/app")?.kind).toBe("password in URL");
    expect(findSecret("postgres://postgres:postgres@localhost:5432/dev")).toBeUndefined();
    expect(findSecret("postgres://app:${DB_PASSWORD}@db/app")).toBeUndefined();
  });

  it("finds NAME=value assignments in commands", () => {
    expect(findSecret("Bash(PGPASSWORD='hunter2hunter2' psql *)")).toMatchObject({
      kind: "PGPASSWORD in a command",
      preview: "hunt…**** (14 chars)",
    });
    expect(findSecret("API_KEY=$API_KEY node x.js")).toBeUndefined();
    expect(findSecret("TOKEN_URL_BASE=https://auth.example.com node x.js")).toBeUndefined();
  });

  it("ignores ordinary text", () => {
    expect(findSecret("npx -y @modelcontextprotocol/server-filesystem ./docs")).toBeUndefined();
  });
});

describe("findNamedSecret", () => {
  it("flags literal values under secret-sounding names", () => {
    expect(findNamedSecret("NOTION_API_KEY", "ntn_abcdefghijklmnop")?.kind).toBe(
      "literal value in NOTION_API_KEY",
    );
    expect(findNamedSecret("Authorization", "Bearer abcdef0123456789")?.preview).toBe("abcd…**** (16 chars)");
  });

  it.each([
    ["API_KEY", "${API_KEY}"],
    ["API_KEY", "<your-api-key>"],
    ["API_KEY", "YOUR_API_KEY"],
    ["API_KEY", "short"],
    ["GOOGLE_APPLICATION_CREDENTIALS_PATH", "/Users/me/sa.json"],
    ["AUTH_FILE", "./auth.json"],
    ["REGION", "us-east-1-long-value"],
    ["TOKEN", "two words"],
  ])("does not flag %s=%s", (name, value) => {
    expect(findNamedSecret(name, value)).toBeUndefined();
  });
});
