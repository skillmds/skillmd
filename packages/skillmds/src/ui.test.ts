import { describe, it, expect } from "vitest";
import { renderInstallSummary, shortPath, table } from "./ui.js";

describe("table", () => {
  it("aligns columns and never exceeds the width budget", () => {
    const out = table([["name", "agent", "path"], ["demo", "claude-code", "/very/long/path/that/keeps/going/and/going/and/going"]], { width: 60 });
    for (const line of out.split("\n")) expect(line.replace(/\x1b\[[0-9;]*m/g, "").length).toBeLessThanOrEqual(60);
    expect(out).toMatch(/demo\s+claude-code/);
  });
});

describe("shortPath", () => {
  it("replaces the home dir with ~ and the cwd with ./", () => {
    expect(shortPath("/home/u/.claude/skills/x", { home: "/home/u", cwd: "/home/u/proj" })).toBe("~/.claude/skills/x");
    expect(shortPath("/home/u/proj/.agents/skills/x", { home: "/home/u", cwd: "/home/u/proj" })).toBe("./.agents/skills/x");
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
    const plain = out.replace(/\x1b\[[0-9;]*m/g, "");
    expect(plain).toMatch(/✓ demo\s+score 92\s+docs_only\s+from registry:o\/demo/);
    expect(plain).toMatch(/claude-code\s+~\/.claude\/skills\/demo\s+junction/);
    expect(plain).toMatch(/codex\s+~\/.agents\/skills\/demo\s+canonical/);
    expect(plain).toMatch(/↷ cursor.*not present/);
  });
  it("collapses agents that share one path into a single row", () => {
    const out = renderInstallSummary({ name: "d", score: 90, flags: [], source: "registry:o/d", canonical: "/h/.agents/skills/d",
      targets: [{ agent: "warp", path: "/h/.agents/skills/d", mode: "canonical" }, { agent: "cline", path: "/h/.agents/skills/d", mode: "canonical" }], skipped: [] }, { home: "/h", cwd: "/h/p", width: 100 });
    const plain = out.replace(/\x1b\[[0-9;]*m/g, "");
    expect(plain).toMatch(/warp, cline\s+~\/.agents\/skills\/d\s+canonical/);
  });
});
