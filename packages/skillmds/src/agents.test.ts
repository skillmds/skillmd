import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AGENTS, agentDir, agentRootExists, agentSupportsGlobal, canonicalDir, detectAgents, installedSkills, writeSkill } from "./agents.js";

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
    expect(agentDir("antigravity", { cwd })).toBe(join(cwd, ".agent", "skills"));
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

describe("1.2 agent table", () => {
  it("canonical dir is .agents/skills in both scopes", () => {
    expect(canonicalDir({ cwd: "/p" })).toBe(join("/p", ".agents", "skills"));
    expect(canonicalDir({ global: true, home: "/h" })).toBe(join("/h", ".agents", "skills"));
  });
  it("honours CLAUDE_CONFIG_DIR and CODEX_HOME for global dirs", () => {
    const home = tmp();
    expect(agentDir("claude-code", { global: true, home, env: { CLAUDE_CONFIG_DIR: "/cfg/claude" } })).toBe(join("/cfg/claude", "skills"));
    expect(agentDir("codex", { global: true, home, env: { CODEX_HOME: "/cfg/codex" } })).toBe(join("/cfg/codex", "skills"));
    expect(agentDir("codex", { global: true, home, env: {} })).toBe(join(home, ".codex", "skills"));
  });
  it("codex/gemini/antigravity/droid project dirs follow the agents' own conventions", () => {
    expect(agentDir("codex", { cwd: "/p" })).toBe(join("/p", ".agents", "skills"));
    expect(agentDir("gemini-cli", { cwd: "/p" })).toBe(join("/p", ".gemini", "skills"));
    expect(agentDir("antigravity", { cwd: "/p" })).toBe(join("/p", ".agent", "skills"));
    expect(agentDir("droid", { cwd: "/p" })).toBe(join("/p", ".factory", "skills"));
  });
  it("agentRootExists is true when the agent's project root dir (or a legacy one) exists", () => {
    const cwd = tmp();
    expect(agentRootExists("cursor", cwd)).toBe(false);
    mkdirSync(join(cwd, ".cursor"));
    expect(agentRootExists("cursor", cwd)).toBe(true);
    const cwd2 = tmp();
    mkdirSync(join(cwd2, ".codex"));
    expect(agentRootExists("codex", cwd2)).toBe(true);
  });
  it("the shared canonical .agents root never marks an agent present", () => {
    const cwd = tmp();
    mkdirSync(join(cwd, ".agents"));
    expect(agentRootExists("gemini-cli", cwd)).toBe(false);
    mkdirSync(join(cwd, ".gemini"));
    expect(agentRootExists("gemini-cli", cwd)).toBe(true);
  });
  it("project-only agents report no global support", () => {
    expect(agentSupportsGlobal("eve")).toBe(false);
    expect(agentSupportsGlobal("claude-code")).toBe(true);
    expect(() => agentDir("eve", { global: true, home: "/h" })).toThrow(/does not support global/);
  });
  it("every agent has a unique id and non-empty dirs", () => {
    const ids = AGENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of AGENTS) { expect(a.project.length).toBeGreaterThan(0); expect(a.detect.length).toBeGreaterThan(0); expect(a.projectRoots.length).toBeGreaterThan(0); }
  });
});

describe("presence markers and env-dir detection", () => {
  it("openclaw is marked present by .openclaw, not by a bare skills/ dir", () => {
    const cwd = tmp();
    mkdirSync(join(cwd, "skills"));
    expect(agentRootExists("openclaw", cwd)).toBe(false);
    const cwd2 = tmp();
    mkdirSync(join(cwd2, ".openclaw"));
    expect(agentRootExists("openclaw", cwd2)).toBe(true);
    expect(agentDir("openclaw", { cwd: "/p" })).toBe(join("/p", "skills"));
  });

  it("a file (not a directory) named like a project root does not mark the agent present", () => {
    const cwd = tmp();
    writeFileSync(join(cwd, ".cursor"), "not a dir");
    expect(agentRootExists("cursor", cwd)).toBe(false);
  });

  it("detectAgents honours a config-dir env var pointing at an existing dir", () => {
    const home = tmp();
    const cfg = tmp();
    expect(detectAgents({ home, env: {} })).toEqual([]);
    expect(detectAgents({ home, env: { CLAUDE_CONFIG_DIR: cfg } })).toEqual(["claude-code"]);
    expect(detectAgents({ home, env: { CLAUDE_CONFIG_DIR: join(cfg, "nope") } })).toEqual([]);
  });
});
