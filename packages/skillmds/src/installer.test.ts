import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, existsSync, readFileSync, writeFileSync, lstatSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installSkill, uninstallSkill, digestOf } from "./installer.js";
import { readLock } from "./lock.js";

const tmps: string[] = [];
const tmp = () => { const d = mkdtempSync(join(tmpdir(), "skillmd-inst-")); tmps.push(d); return d; };
afterEach(() => { for (const d of tmps.splice(0)) rmSync(d, { recursive: true, force: true }); });

const files = [{ path: "SKILL.md", contents: "---\nname: demo\ndescription: d\n---\nbody" }, { path: "ref/a.md", contents: "A" }];

describe("installSkill", () => {
  it("writes the canonical copy once and links each agent dir to it", async () => {
    const cwd = tmp(); mkdirSync(join(cwd, ".cursor")); mkdirSync(join(cwd, ".claude"));
    const r = await installSkill({ name: "demo", files, source: "registry:o/demo", scope: { global: false, cwd }, agents: ["claude-code", "cursor", "codex"] });
    expect(readFileSync(join(cwd, ".agents", "skills", "demo", "SKILL.md"), "utf8")).toContain("name: demo");
    expect(readFileSync(join(cwd, ".claude", "skills", "demo", "ref", "a.md"), "utf8")).toBe("A");
    expect(lstatSync(join(cwd, ".cursor", "skills", "demo")).isSymbolicLink()).toBe(true);
    expect(r.targets.find((t) => t.agent === "codex")?.mode).toBe("canonical");
    expect(["junction", "symlink"]).toContain(r.targets.find((t) => t.agent === "cursor")?.mode);
    expect(readLock({ global: false, cwd }).skills.demo?.source).toBe("registry:o/demo");
  });

  it("never creates an agent dir the project does not already have (litter rule)", async () => {
    const cwd = tmp();
    const r = await installSkill({ name: "demo", files, source: "registry:o/demo", scope: { global: false, cwd }, agents: ["claude-code", "cursor", "kiro"] });
    expect(existsSync(join(cwd, ".cursor"))).toBe(false);
    expect(existsSync(join(cwd, ".kiro"))).toBe(false);
    expect(existsSync(join(cwd, ".agents", "skills", "demo", "SKILL.md"))).toBe(true);
    expect(r.skipped.map((s) => s.agent).sort()).toEqual(["claude-code", "cursor", "kiro"]);
    expect(r.skipped[0]?.reason).toMatch(/not present in this project/);
  });

  it("explicit agents (-a) bypass the litter rule", async () => {
    const cwd = tmp();
    await installSkill({ name: "demo", files, source: "registry:o/demo", scope: { global: false, cwd }, agents: ["cursor"], explicitAgents: true });
    expect(existsSync(join(cwd, ".cursor", "skills", "demo", "SKILL.md"))).toBe(true);
  });

  it("global scope writes every requested agent", async () => {
    const home = tmp();
    await installSkill({ name: "demo", files, source: "registry:o/demo", scope: { global: true, home }, agents: ["claude-code", "windsurf"] });
    expect(existsSync(join(home, ".agents", "skills", "demo", "SKILL.md"))).toBe(true);
    expect(existsSync(join(home, ".claude", "skills", "demo", "SKILL.md"))).toBe(true);
    expect(existsSync(join(home, ".codeium", "windsurf", "skills", "demo", "SKILL.md"))).toBe(true);
  });

  it("falls back to a copy when linking fails, and records mode=copy", async () => {
    const home = tmp();
    const r = await installSkill({ name: "demo", files, source: "registry:o/demo", scope: { global: true, home }, agents: ["claude-code"],
      link: () => { throw Object.assign(new Error("EPERM"), { code: "EPERM" }); } });
    expect(r.targets[0]?.mode).toBe("copy");
    expect(lstatSync(join(home, ".claude", "skills", "demo")).isDirectory()).toBe(true);
    expect(readFileSync(join(home, ".claude", "skills", "demo", "SKILL.md"), "utf8")).toContain("demo");
  });

  it("--mode copy forces copies", async () => {
    const home = tmp();
    const r = await installSkill({ name: "demo", files, source: "registry:o/demo", scope: { global: true, home }, agents: ["claude-code"], mode: "copy" });
    expect(r.targets[0]?.mode).toBe("copy");
  });

  it("replaces atomically: stale files vanish, nothing half-written on failure", async () => {
    const home = tmp();
    await installSkill({ name: "demo", files: [...files, { path: "old.md", contents: "OLD" }], source: "registry:o/demo", scope: { global: true, home }, agents: ["claude-code"] });
    await installSkill({ name: "demo", files, source: "registry:o/demo", scope: { global: true, home }, agents: ["claude-code"] });
    expect(existsSync(join(home, ".agents", "skills", "demo", "old.md"))).toBe(false);
    await expect(installSkill({ name: "demo", files: [{ path: "../escape.md", contents: "x" }], source: "registry:o/demo", scope: { global: true, home }, agents: ["claude-code"] })).rejects.toThrow(/unsafe path/);
    expect(readFileSync(join(home, ".agents", "skills", "demo", "SKILL.md"), "utf8")).toContain("demo");
    expect(existsSync(join(home, ".agents", "skills", "demo.tmp-" + process.pid))).toBe(false);
  });

  it("refuses to replace a skill from a different source without force", async () => {
    const home = tmp();
    await installSkill({ name: "notes", files, source: "local:/me/notes", scope: { global: true, home }, agents: ["claude-code"] });
    await expect(installSkill({ name: "notes", files, source: "registry:o/notes", scope: { global: true, home }, agents: ["claude-code"] }))
      .rejects.toThrow(/already installed from local:\/me\/notes.*--force/);
    const r = await installSkill({ name: "notes", files, source: "registry:o/notes", scope: { global: true, home }, agents: ["claude-code"], force: true });
    expect(r.replaced).toBe("local:/me/notes");
  });

  it("refuses to replace an untracked dir (no lock entry) without force", async () => {
    const home = tmp();
    mkdirSync(join(home, ".agents", "skills", "hand"), { recursive: true });
    writeFileSync(join(home, ".agents", "skills", "hand", "SKILL.md"), "mine");
    await expect(installSkill({ name: "hand", files, source: "registry:o/hand", scope: { global: true, home }, agents: ["claude-code"] })).rejects.toThrow(/not tracked.*--force/);
  });

  it("rejects Windows reserved names and bad skill names", async () => {
    const home = tmp();
    await expect(installSkill({ name: "con", files, source: "x", scope: { global: true, home }, agents: ["claude-code"] })).rejects.toThrow(/reserved/);
    await expect(installSkill({ name: "../x", files, source: "x", scope: { global: true, home }, agents: ["claude-code"] })).rejects.toThrow(/unsafe skill name/);
  });
});

describe("uninstallSkill", () => {
  it("removes links, the canonical copy and the lock entry", async () => {
    const home = tmp();
    await installSkill({ name: "demo", files, source: "registry:o/demo", scope: { global: true, home }, agents: ["claude-code", "windsurf"] });
    const r = uninstallSkill("demo", { global: true, home });
    expect(r.removed.length).toBeGreaterThanOrEqual(2);
    expect(existsSync(join(home, ".claude", "skills", "demo"))).toBe(false);
    expect(existsSync(join(home, ".agents", "skills", "demo"))).toBe(false);
    expect(readLock({ global: true, home }).skills.demo).toBeUndefined();
  });
  it("removes an untracked 1.1.x-style copy too, but only dirs that hold a SKILL.md", () => {
    const home = tmp();
    mkdirSync(join(home, ".claude", "skills", "old"), { recursive: true });
    writeFileSync(join(home, ".claude", "skills", "old", "SKILL.md"), "x");
    mkdirSync(join(home, ".cursor", "skills", "old"), { recursive: true });
    const r = uninstallSkill("old", { global: true, home });
    expect(r.removed).toEqual([join(home, ".claude", "skills", "old")]);
    expect(existsSync(join(home, ".cursor", "skills", "old"))).toBe(true);
  });
});

describe("digestOf", () => {
  it("is order-independent and content-sensitive", () => {
    expect(digestOf(files)).toBe(digestOf([...files].reverse()));
    expect(digestOf(files)).not.toBe(digestOf([{ path: "SKILL.md", contents: "other" }]));
  });
});
