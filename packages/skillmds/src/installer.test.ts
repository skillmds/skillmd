import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, existsSync, readFileSync, writeFileSync, lstatSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installSkill, uninstallSkill, digestOf, listInstalled, defaultLink } from "./installer.js";
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
  it("never deletes a non-skill dir when linking fails (copy fallback)", async () => {
    const home = tmp();
    mkdirSync(join(home, ".claude", "skills", "demo"), { recursive: true });
    writeFileSync(join(home, ".claude", "skills", "demo", "my-notes.txt"), "keep me");
    await expect(installSkill({ name: "demo", files, source: "registry:o/demo", scope: { global: true, home }, agents: ["claude-code"],
      link: () => { throw Object.assign(new Error("EEXIST"), { code: "EEXIST" }); } })).rejects.toThrow();
    expect(existsSync(join(home, ".claude", "skills", "demo", "my-notes.txt"))).toBe(true);
  });

  it("rethrows the link error instead of copying over a non-link path, even under --force", async () => {
    const home = tmp();
    mkdirSync(join(home, ".claude", "skills", "demo"), { recursive: true });
    writeFileSync(join(home, ".claude", "skills", "demo", "my-notes.txt"), "keep me");
    await expect(installSkill({ name: "demo", files, source: "registry:o/demo", scope: { global: true, home }, agents: ["claude-code"], force: true,
      link: () => { throw Object.assign(new Error("EEXIST"), { code: "EEXIST" }); } })).rejects.toThrow(/EEXIST/);
    expect(readFileSync(join(home, ".claude", "skills", "demo", "my-notes.txt"), "utf8")).toBe("keep me");
  });

  it("removes a half-created link and falls back to a copy", async () => {
    const home = tmp();
    let n = 0;
    const r = await installSkill({ name: "demo", files, source: "registry:o/demo", scope: { global: true, home }, agents: ["claude-code"],
      link: (target, linkPath) => { n++; defaultLink(target, linkPath); throw new Error("EPERM"); } });
    expect(n).toBe(1);
    expect(r.targets[0]?.mode).toBe("copy");
    expect(lstatSync(join(home, ".claude", "skills", "demo")).isSymbolicLink()).toBe(false);
    expect(readFileSync(join(home, ".claude", "skills", "demo", "SKILL.md"), "utf8")).toContain("demo");
  });

  it("force gate covers untracked per-agent dirs, not just the canonical copy", async () => {
    const home = tmp();
    const hand = join(home, ".claude", "skills", "mine");
    mkdirSync(hand, { recursive: true });
    writeFileSync(join(hand, "SKILL.md"), "HANDWRITTEN");
    await expect(installSkill({ name: "mine", files, source: "registry:o/mine", scope: { global: true, home }, agents: ["claude-code"] }))
      .rejects.toThrow(/not tracked[\s\S]*--force/);
    expect(readFileSync(join(hand, "SKILL.md"), "utf8")).toBe("HANDWRITTEN");
    const r = await installSkill({ name: "mine", files, source: "registry:o/mine", scope: { global: true, home }, agents: ["claude-code"], force: true });
    expect(r.replaced).toBe("untracked");
    expect(readFileSync(join(hand, "SKILL.md"), "utf8")).toContain("name: demo");
  });

  it("leaves no .old-* or .tmp-* dirs behind after a re-install", async () => {
    const home = tmp();
    const canonRoot = join(home, ".agents", "skills");
    await installSkill({ name: "demo", files, source: "registry:o/demo", scope: { global: true, home }, agents: ["claude-code"] });
    await installSkill({ name: "demo", files, source: "registry:o/demo", scope: { global: true, home }, agents: ["claude-code"] });
    expect(readdirSync(canonRoot)).toEqual(["demo"]);
  });

  it("reports an agent sharing an already-written dir as a target, not as absent", async () => {
    const cwd = tmp(); mkdirSync(join(cwd, ".github"));
    const r = await installSkill({ name: "demo", files, source: "registry:o/demo", scope: { global: false, cwd }, agents: ["github-copilot", "claude-code"] });
    expect(r.skipped).toEqual([]);
    const copilot = r.targets.find((t) => t.agent === "github-copilot");
    const claude = r.targets.find((t) => t.agent === "claude-code");
    expect(copilot?.path).toBe(join(cwd, ".claude", "skills", "demo"));
    expect(claude?.path).toBe(copilot?.path);
    expect(claude?.mode).toBe(copilot?.mode);
  });

  it("refuses a skill with no files", async () => {
    const home = tmp();
    await expect(installSkill({ name: "demo", files: [], source: "registry:o/demo", scope: { global: true, home }, agents: ["claude-code"] }))
      .rejects.toThrow(/skill has no files/);
  });

  it("refuses file names that end in a dot or a space", async () => {
    const home = tmp();
    await expect(installSkill({ name: "demo", files: [{ path: "trailing./x.md", contents: "x" }], source: "registry:o/demo", scope: { global: true, home }, agents: ["claude-code"] }))
      .rejects.toThrow(/invalid file name/);
    await expect(installSkill({ name: "demo", files: [{ path: "trailing /x.md", contents: "x" }], source: "registry:o/demo", scope: { global: true, home }, agents: ["claude-code"] }))
      .rejects.toThrow(/invalid file name/);
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

  it("hashes windows and posix separators the same", () => {
    expect(digestOf([{ path: "a\\b.md", contents: "x" }])).toBe(digestOf([{ path: "a/b.md", contents: "x" }]));
  });
});

describe("listInstalled", () => {
  it("reports a tracked skill at its canonical path with the lock's agents", async () => {
    const home = tmp();
    await installSkill({ name: "demo", files, source: "registry:o/demo", scope: { global: true, home }, agents: ["claude-code"] });
    const found = listInstalled({ global: true, home }).find((s) => s.name === "demo");
    expect(found?.tracked).toBe(true);
    expect(found?.path).toBe(join(home, ".agents", "skills", "demo"));
    expect(found?.agents).toEqual(["claude-code"]);
    expect(found?.source).toBe("registry:o/demo");
    expect(found?.scope).toBe("global");
  });

  it("reports an untracked 1.1.x-style copy as tracked:false with mode copy", () => {
    const home = tmp();
    mkdirSync(join(home, ".claude", "skills", "old"), { recursive: true });
    writeFileSync(join(home, ".claude", "skills", "old", "SKILL.md"), "x");
    const found = listInstalled({ global: true, home }).find((s) => s.name === "old");
    expect(found?.tracked).toBe(false);
    expect(found?.path).toBe(join(home, ".claude", "skills", "old"));
    expect(found?.mode).toEqual({ "claude-code": "copy" });
  });

  it("ignores a dangling link whose target is gone", () => {
    const home = tmp();
    const target = join(home, ".agents", "skills", "ghost");
    mkdirSync(target, { recursive: true });
    writeFileSync(join(target, "SKILL.md"), "x");
    mkdirSync(join(home, ".claude", "skills"), { recursive: true });
    defaultLink(target, join(home, ".claude", "skills", "ghost"));
    rmSync(target, { recursive: true, force: true });
    expect(listInstalled({ global: true, home }).map((s) => s.name)).toEqual([]);
  });

  it("sorts by name", () => {
    const home = tmp();
    for (const n of ["zeta", "alpha", "mid"]) {
      mkdirSync(join(home, ".claude", "skills", n), { recursive: true });
      writeFileSync(join(home, ".claude", "skills", n, "SKILL.md"), "x");
    }
    expect(listInstalled({ global: true, home }).map((s) => s.name)).toEqual(["alpha", "mid", "zeta"]);
  });
});
