import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runRemove } from "./remove.js";
import type { RemoveDeps } from "./remove.js";
import { installSkill } from "../installer.js";
import { readLock } from "../lock.js";

const tmps: string[] = [];
const tmp = () => { const d = mkdtempSync(join(tmpdir(), "skillmd-rm-")); tmps.push(d); return d; };
afterEach(() => { for (const d of tmps.splice(0)) rmSync(d, { recursive: true, force: true }); });
const files = [{ path: "SKILL.md", contents: "---\nname: x\ndescription: d\n---\nbody" }];
const yes: RemoveDeps = { confirm: async () => true, pick: async ({ names }) => names };

async function seed() {
  const home = tmp(); mkdirSync(join(home, ".claude")); mkdirSync(join(home, ".cursor"));
  await installSkill({ name: "a", files, source: "registry:o/a", scope: { global: true, home }, agents: ["claude-code", "cursor"] });
  await installSkill({ name: "b", files, source: "registry:o/b", scope: { global: true, home }, agents: ["claude-code"] });
  return home;
}

describe("runRemove", () => {
  it("removes named skills from every agent plus canonical and lock, exit 0", async () => {
    const home = await seed();
    const r = await runRemove(["a"], { global: true, home, yes: true }, yes);
    expect(r.exitCode).toBe(0);
    expect(existsSync(join(home, ".claude", "skills", "a"))).toBe(false);
    expect(existsSync(join(home, ".cursor", "skills", "a"))).toBe(false);
    expect(existsSync(join(home, ".agents", "skills", "a"))).toBe(false);
    expect(readLock({ global: true, home }).skills.a).toBeUndefined();
    expect(readLock({ global: true, home }).skills.b).toBeDefined();
  });
  it("exits 1 and says so when nothing matched", async () => {
    const home = await seed();
    const r = await runRemove(["nope"], { global: true, home, yes: true }, yes);
    expect(r.exitCode).toBe(1);
    expect(r.output).toMatch(/nope.*not installed/);
  });
  it("-a removes only that agent's link and keeps the canonical copy while others use it", async () => {
    const home = await seed();
    const r = await runRemove(["a"], { global: true, home, yes: true, agent: ["cursor"] }, yes);
    expect(r.exitCode).toBe(0);
    expect(existsSync(join(home, ".cursor", "skills", "a"))).toBe(false);
    expect(existsSync(join(home, ".claude", "skills", "a"))).toBe(true);
    expect(existsSync(join(home, ".agents", "skills", "a"))).toBe(true);
    expect(readLock({ global: true, home }).skills.a?.agents).toEqual(["claude-code"]);
  });
  it("--all removes everything in scope; --all with names is refused", async () => {
    const home = await seed();
    const bad = await runRemove(["a"], { global: true, home, all: true, yes: true }, yes);
    expect(bad.exitCode).toBe(1);
    expect(bad.output).toMatch(/--all.*names/);
    const r = await runRemove([], { global: true, home, all: true, yes: true }, yes);
    expect(r.exitCode).toBe(0);
    expect(readLock({ global: true, home }).skills).toEqual({});
  });
  it("--all says so when the scope holds nothing, instead of printing a blank line", async () => {
    const home = tmp();
    const r = await runRemove([], { global: true, home, all: true, yes: true }, yes);
    expect(r.exitCode).toBe(1);
    expect(r.output).toMatch(/No installed skills found in global scope\./);
    const asJson = await runRemove([], { global: true, home, all: true, yes: true, json: true }, yes);
    expect(JSON.parse(asJson.output)).toMatchObject({ ok: false, error: "No installed skills found in global scope." });
  });
  it("asks for confirmation unless -y; a declined confirm removes nothing and exits 0", async () => {
    const home = await seed();
    let asked = 0;
    const r = await runRemove(["a"], { global: true, home }, { confirm: async () => { asked++; return false; }, pick: yes.pick });
    expect(asked).toBe(1);
    expect(r.exitCode).toBe(0);
    expect(r.cancelled).toBe(true);
    expect(existsSync(join(home, ".agents", "skills", "a"))).toBe(true);
  });
  it("-a never deletes the canonical copy an agent reads directly", async () => {
    const cwd = tmp(); const home = tmp();
    mkdirSync(join(cwd, ".claude")); mkdirSync(join(cwd, ".git"));
    await installSkill({ name: "x", files, source: "registry:o/x", scope: { cwd, home }, agents: ["claude-code", "codex"] });
    const r = await runRemove(["x"], { cwd, home, yes: true, agent: ["codex"] }, yes);
    expect(r.exitCode).toBe(0);
    expect(existsSync(join(cwd, ".agents", "skills", "x", "SKILL.md"))).toBe(true);
    expect(existsSync(join(cwd, ".claude", "skills", "x", "SKILL.md"))).toBe(true);
    expect(readLock({ global: false, cwd }).skills.x?.agents).toEqual(["claude-code"]);
    expect(readLock({ global: false, cwd }).skills.x?.mode.codex).toBeUndefined();
    expect(r.output).toMatch(/canonical copy directly/);
  });
  it("says which agents did not hold the skill instead of exiting 1 silently", async () => {
    const home = await seed();
    const r = await runRemove(["b"], { global: true, home, yes: true, agent: ["cursor"] }, yes);
    expect(r.exitCode).toBe(1);
    expect(r.output).toMatch(/b is not linked into cursor/);
  });
  it("--json emits a JSON document on every path", async () => {
    const home = await seed();
    const refused = await runRemove(["a"], { global: true, home, all: true, yes: true, json: true }, yes);
    expect(JSON.parse(refused.output).ok).toBe(false);
    const miss = await runRemove(["nope"], { global: true, home, yes: true, json: true }, yes);
    const doc = JSON.parse(miss.output) as { ok: boolean; missing: string[] };
    expect(doc.ok).toBe(false);
    expect(doc.missing).toEqual(["nope"]);
    const declined = await runRemove(["a"], { global: true, home, json: true }, { confirm: async () => false });
    expect(JSON.parse(declined.output)).toMatchObject({ ok: true, removed: [], cancelled: true });
  });
  it("removes from both scopes by default; -g/-p narrow it", async () => {
    const cwd = tmp(); const home = tmp(); mkdirSync(join(home, ".claude")); mkdirSync(join(cwd, ".claude"));
    await installSkill({ name: "p", files, source: "registry:o/p", scope: { cwd, home }, agents: ["claude-code"] });
    await installSkill({ name: "g", files, source: "registry:o/g", scope: { global: true, home }, agents: ["claude-code"] });
    const onlyGlobal = await runRemove(["p"], { cwd, home, yes: true, global: true }, yes);
    expect(onlyGlobal.exitCode).toBe(1);
    expect(onlyGlobal.output).toMatch(/p not installed/);
    const r = await runRemove(["p", "g"], { cwd, home, yes: true }, yes);
    expect(r.exitCode).toBe(0);
    expect(existsSync(join(cwd, ".agents", "skills", "p"))).toBe(false);
    expect(existsSync(join(home, ".agents", "skills", "g"))).toBe(false);
  });
  it("with no names offers a picker; no picker available → exit 1 with a hint", async () => {
    const home = await seed();
    const picked = await runRemove([], { global: true, home, yes: true }, { ...yes, pick: async () => ["b"] });
    expect(picked.exitCode).toBe(0);
    expect(existsSync(join(home, ".agents", "skills", "b"))).toBe(false);
    const noTty = await runRemove([], { global: true, home, yes: true }, { confirm: async () => true });
    expect(noTty.exitCode).toBe(1);
    expect(noTty.output).toMatch(/name.*--all/);
  });
});
