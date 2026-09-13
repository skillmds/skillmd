import { describe, it, expect } from "vitest";
import { detectHostAgent, isInteractive, createReporter, scopesFor } from "./env.js";

describe("detectHostAgent", () => {
  it("recognises the agents that launch CLIs non-interactively", () => {
    expect(detectHostAgent({ CLAUDECODE: "1" })).toBe("claude-code");
    expect(detectHostAgent({ CURSOR_AGENT: "1" })).toBe("cursor");
    expect(detectHostAgent({ CODEX_SANDBOX: "seatbelt" })).toBe("codex");
    expect(detectHostAgent({ GEMINI_CLI: "1" })).toBe("gemini-cli");
    expect(detectHostAgent({ CI: "true" })).toBe("ci");
    expect(detectHostAgent({})).toBeNull();
  });
  it("ignores Cursor's trace id alone (set for every Cursor terminal)", () => {
    expect(detectHostAgent({ CURSOR_TRACE_ID: "abc" })).toBeNull();
  });
});

describe("isInteractive", () => {
  it("needs both TTYs, no -y/--json and no host agent", () => {
    const tty = { stdinTTY: true, stdoutTTY: true, env: {} };
    expect(isInteractive({}, tty)).toBe(true);
    expect(isInteractive({ yes: true }, tty)).toBe(false);
    expect(isInteractive({ json: true }, tty)).toBe(false);
    expect(isInteractive({}, { ...tty, stdinTTY: false })).toBe(false);
    expect(isInteractive({}, { ...tty, env: { CLAUDECODE: "1" } })).toBe(false);
  });
});

describe("createReporter", () => {
  it("in json mode writes exactly one JSON document to stdout and text to stderr", () => {
    const out: string[] = []; const err: string[] = [];
    const r = createReporter({ json: true }, { out: (s) => out.push(s), err: (s) => err.push(s) });
    r.info("resolving…");
    r.result({ ok: true, n: 2 });
    expect(err).toEqual(["resolving…"]);
    expect(out).toHaveLength(1);
    expect(JSON.parse(out[0]!)).toEqual({ ok: true, n: 2 });
  });
  it("in human mode writes text to stdout and ignores result()", () => {
    const out: string[] = []; const err: string[] = [];
    const r = createReporter({}, { out: (s) => out.push(s), err: (s) => err.push(s) });
    r.info("hello");
    r.result({ ok: true });
    expect(out).toEqual(["hello"]);
    expect(err).toEqual([]);
  });
});

describe("scopesFor", () => {
  it("defaults to both scopes and narrows with -g/-p", () => {
    expect(scopesFor({})).toEqual([false, true]);
    expect(scopesFor({ global: true })).toEqual([true]);
    expect(scopesFor({ project: true })).toEqual([false]);
    expect(scopesFor({ global: true, project: true })).toEqual([false, true]);
  });
});
