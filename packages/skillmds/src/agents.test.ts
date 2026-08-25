import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { agentDir, detectAgents, installedSkills, writeSkill } from "./agents.js";

const tmps: string[] = [];
function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), "skillmd-test-"));
  tmps.push(d);
  return d;
}
afterEach(() => { for (const d of tmps.splice(0)) rmSync(d, { recursive: true, force: true }); });

describe("agentDir", () => {
  it("resolves a project-scope claude-code dir", () => {
    const cwd = tmp();
    expect(agentDir("claude-code", { cwd })).toBe(join(cwd, ".claude", "skills"));
  });
  it("resolves scope-specific dirs where they differ (windsurf, antigravity)", () => {
    const cwd = tmp();
    const home = tmp();
    expect(agentDir("windsurf", { cwd })).toBe(join(cwd, ".windsurf", "skills"));
    expect(agentDir("windsurf", { global: true, home })).toBe(join(home, ".codeium", "windsurf", "skills"));
    expect(agentDir("antigravity", { cwd })).toBe(join(cwd, ".agents", "skills"));
    expect(agentDir("antigravity", { global: true, home })).toBe(join(home, ".gemini", "antigravity", "skills"));
  });
  it("throws on unknown agent", () => {
    expect(() => agentDir("nope")).toThrow(/Unknown agent/);
  });
});

describe("detectAgents", () => {
  it("detects agents by their root config dir, not a pre-existing skills dir", () => {
    const home = tmp();
    for (const dir of [".claude", ".cursor", ".kiro", ".gemini", ".antigravity", ".warp"]) {
      mkdirSync(join(home, dir), { recursive: true });
    }
    expect(detectAgents({ home })).toEqual(["claude-code", "cursor", "gemini-cli", "antigravity", "kiro", "warp"]);
  });
  it("detects windsurf via either .codeium/windsurf or legacy .windsurf", () => {
    const a = tmp();
    mkdirSync(join(a, ".codeium", "windsurf"), { recursive: true });
    expect(detectAgents({ home: a })).toEqual(["windsurf"]);
    const b = tmp();
    mkdirSync(join(b, ".windsurf"), { recursive: true });
    expect(detectAgents({ home: b })).toEqual(["windsurf"]);
  });
  it("returns empty for a bare home", () => {
    expect(detectAgents({ home: tmp() })).toEqual([]);
  });
  it("detects extended-registry agents (openclaw legacy dirs, kilo, hermes)", () => {
    const home = tmp();
    for (const dir of [".clawdbot", ".kilocode", ".hermes"]) mkdirSync(join(home, dir), { recursive: true });
    expect(detectAgents({ home })).toEqual(["openclaw", "kilo", "hermes-agent"]);
    expect(agentDir("openclaw", { global: true, home })).toBe(join(home, ".openclaw", "skills"));
    expect(agentDir("kilo", { global: true, home })).toBe(join(home, ".kilocode", "skills"));
  });
});

describe("writeSkill + installedSkills", () => {
  it("writes a skill and finds it", () => {
    const cwd = tmp();
    const target = agentDir("claude-code", { cwd });
    mkdirSync(target, { recursive: true });
    writeSkill("foo", [{ path: "SKILL.md", contents: "---\nname: foo\ndescription: d\n---\nbody" }], target);
    const found = installedSkills({ cwd });
    expect(found.map((s) => s.name)).toContain("foo");
    expect(found[0]?.agent).toBe("claude-code");
  });

  it("refuses a skill name that escapes the target dir", () => {
    const cwd = tmp();
    const target = agentDir("claude-code", { cwd });
    mkdirSync(target, { recursive: true });
    expect(() =>
      writeSkill("../../evil", [{ path: "SKILL.md", contents: "x" }], target),
    ).toThrow(/unsafe skill name/);
  });

  it("refuses a per-file path that escapes the skill dir (zip-slip)", () => {
    const cwd = tmp();
    const target = agentDir("claude-code", { cwd });
    mkdirSync(target, { recursive: true });
    expect(() =>
      writeSkill("ok", [{ path: "../../../etc/pwn", contents: "x" }], target),
    ).toThrow(/unsafe path/);
  });
});
