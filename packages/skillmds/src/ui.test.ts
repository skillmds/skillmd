import { describe, it, expect } from "vitest";
import { GLYPH, renderInstallSummary, shortPath, stripAnsi, table, truncateVisible } from "./ui.js";

// Written as literal SGR sequences rather than through picocolors: whether pc
// emits colour at all depends on the terminal the suite happens to run in.
const DIM = "\x1b[2m";
const UNDIM = "\x1b[22m";
const RESET = "\x1b[0m";

describe("stripAnsi", () => {
  it("removes SGR sequences and leaves the visible text", () => {
    expect(stripAnsi(`${DIM}abc${UNDIM}`)).toBe("abc");
    expect(stripAnsi("plain")).toBe("plain");
  });
});

describe("truncateVisible", () => {
  it("counts visible characters only and closes any style it left open", () => {
    const out = truncateVisible(`${DIM}abcdefghij${UNDIM}`, 5);
    expect(stripAnsi(out)).toBe("abcd…");
    expect(stripAnsi(out)).toHaveLength(5);
    expect(out.endsWith(RESET)).toBe(true);
  });

  it("leaves a string that already fits exactly as it was", () => {
    expect(truncateVisible(`${DIM}abc${UNDIM}`, 5)).toBe(`${DIM}abc${UNDIM}`);
    expect(truncateVisible("abcde", 5)).toBe("abcde");
  });

  it("adds no reset when the text carried no styling", () => {
    expect(truncateVisible("abcdefghij", 5)).toBe("abcd…");
  });
});

describe("table", () => {
  it("aligns columns and never exceeds the width budget", () => {
    const out = table([["name", "agent", "path"], ["demo", "claude-code", "/very/long/path/that/keeps/going/and/going/and/going"]], { width: 60 });
    for (const line of out.split("\n")) expect(stripAnsi(line).length).toBeLessThanOrEqual(60);
    expect(out).toMatch(/demo\s+claude-code/);
  });

  it("truncates the last column without leaving a dangling escape sequence", () => {
    const out = table([[`${DIM}a${UNDIM}`, `${DIM}${"x".repeat(80)}${UNDIM}`]], { width: 20 });
    expect(stripAnsi(out).length).toBeLessThanOrEqual(20);
    expect(stripAnsi(out).endsWith("…")).toBe(true);
  });
});

describe("shortPath", () => {
  it("replaces the home dir with ~ and the cwd with ./", () => {
    expect(shortPath("/home/u/.claude/skills/x", { home: "/home/u", cwd: "/home/u/proj" })).toBe("~/.claude/skills/x");
    expect(shortPath("/home/u/proj/.agents/skills/x", { home: "/home/u", cwd: "/home/u/proj" })).toBe("./.agents/skills/x");
  });

  it("names the roots themselves without a trailing slash", () => {
    expect(shortPath("/home/u/proj", { home: "/home/u", cwd: "/home/u/proj" })).toBe(".");
    expect(shortPath("/home/u", { home: "/home/u", cwd: "/home/u/proj" })).toBe("~");
  });
});

describe("renderInstallSummary", () => {
  it("lists one row per agent with its mode, then skipped agents dimmed", () => {
    const out = renderInstallSummary({
      name: "demo", score: 92, flags: ["docs_only"], source: "registry:o/demo",
      canonical: "/h/.agents/skills/demo",
      targets: [{ agent: "claude-code", path: "/h/.claude/skills/demo", mode: "junction" }, { agent: "codex", path: "/h/.agents/skills/demo", mode: "canonical" }],
      skipped: [{ agent: "cursor", reason: "not present in this project" }],
    }, { home: "/h", cwd: "/h/p", width: 100 });
    const plain = stripAnsi(out);
    expect(plain).toMatch(/✓ demo\s+score 92\s+docs_only\s+from registry:o\/demo/);
    // The path is the last (truncatable) column, so the short cells never get eaten.
    expect(plain).toMatch(/claude-code\s+junction\s+~\/.claude\/skills\/demo/);
    expect(plain).toMatch(/codex\s+canonical\s+~\/.agents\/skills\/demo/);
    expect(plain).toMatch(/↷ cursor.*not present/);
  });

  it("collapses agents that share one path into a single row", () => {
    const out = renderInstallSummary({ name: "d", score: 90, flags: [], source: "registry:o/d", canonical: "/h/.agents/skills/d",
      targets: [{ agent: "warp", path: "/h/.agents/skills/d", mode: "canonical" }, { agent: "cline", path: "/h/.agents/skills/d", mode: "canonical" }], skipped: [] }, { home: "/h", cwd: "/h/p", width: 100 });
    expect(stripAnsi(out)).toMatch(/warp, cline\s+canonical\s+~\/.agents\/skills\/d/);
  });

  it("keeps every line inside the width budget when the path is very long", () => {
    const out = renderInstallSummary({
      name: "demo", score: 90, flags: [], source: "registry:o/demo",
      canonical: "/h/.agents/skills/demo",
      targets: [{ agent: "claude-code", path: `/h/.claude/${"nested/".repeat(20)}skills/demo`, mode: "junction" }],
      skipped: [],
    }, { home: "/h", cwd: "/h/p", width: 50 });
    for (const line of out.split("\n")) expect(stripAnsi(line).length).toBeLessThanOrEqual(50);
  });

  it("shortens a local: source and keeps the head line inside the width", () => {
    const long = `/h/${"deep/".repeat(20)}demo`;
    const out = renderInstallSummary({
      name: "demo", score: 90, flags: [], source: `local:${long}`, canonical: long,
      targets: [{ agent: "claude-code", path: "/h/.claude/skills/demo", mode: "junction" }],
      skipped: [],
    }, { home: "/h", cwd: "/h/p", width: 50 });
    const head = stripAnsi(out.split("\n")[0]!);
    expect(head).toContain("from local:~/");
    expect(head).not.toContain("/h/deep");
    for (const line of out.split("\n")) expect(stripAnsi(line).length).toBeLessThanOrEqual(50);
  });

  it("marks a replacement with the shared warn glyph", () => {
    const out = renderInstallSummary({
      name: "demo", score: 90, flags: [], source: "registry:o/demo", canonical: "/h/.agents/skills/demo",
      targets: [{ agent: "claude-code", path: "/h/.claude/skills/demo", mode: "junction" }],
      skipped: [], replaced: "untracked",
    }, { home: "/h", cwd: "/h/p", width: 100 });
    expect(stripAnsi(out)).toContain(`${GLYPH.replaced} replaced previous install (untracked directory)`);
    expect(stripAnsi(out).startsWith(`${GLYPH.ok} demo`)).toBe(true);
  });
});
