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
  it("asks for confirmation unless -y; a declined confirm removes nothing and exits 0", async () => {
    const home = await seed();
    let asked = 0;
    const r = await runRemove(["a"], { global: true, home }, { confirm: async () => { asked++; return false; }, pick: yes.pick });
    expect(asked).toBe(1);
    expect(r.exitCode).toBe(0);
    expect(r.cancelled).toBe(true);
    expect(existsSync(join(home, ".agents", "skills", "a"))).toBe(true);
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
