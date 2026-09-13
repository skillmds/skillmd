import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runList } from "./list.js";
import { installSkill } from "../installer.js";

const tmps: string[] = [];
const tmp = () => { const d = mkdtempSync(join(tmpdir(), "skillmd-ls-")); tmps.push(d); return d; };
afterEach(() => { for (const d of tmps.splice(0)) rmSync(d, { recursive: true, force: true }); });
const files = [{ path: "SKILL.md", contents: "---\nname: x\ndescription: A useful description.\n---\nbody" }];

describe("runList", () => {
  it("shows project and global skills together by default, tagged by scope", async () => {
    const cwd = tmp(); const home = tmp(); mkdirSync(join(home, ".claude")); mkdirSync(join(cwd, ".claude"));
    await installSkill({ name: "proj", files, source: "registry:o/proj", scope: { cwd, home }, agents: ["claude-code"] });
    await installSkill({ name: "glob", files, source: "github:o/r#main", scope: { global: true, home }, agents: ["claude-code"] });
    const r = runList({ cwd, home });
    expect(r.items.map((i) => `${i.name}/${i.scope}`).sort()).toEqual(["glob/global", "proj/project"]);
    expect(r.output).toMatch(/proj[\s\S]*project[\s\S]*registry:o\/proj/);
    expect(r.output).toMatch(/glob[\s\S]*global[\s\S]*github:o\/r#main/);
  });
  it("-g / -p restrict the scope; -a filters by agent", async () => {
    const cwd = tmp(); const home = tmp(); mkdirSync(join(home, ".claude")); mkdirSync(join(home, ".cursor"));
    await installSkill({ name: "a", files, source: "registry:o/a", scope: { global: true, home }, agents: ["claude-code"] });
    await installSkill({ name: "b", files, source: "registry:o/b", scope: { global: true, home }, agents: ["cursor"] });
    expect(runList({ cwd, home, global: true }).items.map((i) => i.name)).toEqual(["a", "b"]);
    expect(runList({ cwd, home, project: true }).items).toEqual([]);
    expect(runList({ cwd, home, agent: ["cursor"] }).items.map((i) => i.name)).toEqual(["b"]);
  });
  it("marks untracked (hand-copied) skills and sanitises their descriptions", () => {
    const cwd = tmp(); const home = tmp();
    mkdirSync(join(home, ".claude", "skills", "old"), { recursive: true });
    writeFileSync(join(home, ".claude", "skills", "old", "SKILL.md"), "---\nname: old\ndescription: evil\x1b[2Jtext\n---\nbody");
    const r = runList({ cwd, home });
    expect(r.items[0]).toMatchObject({ name: "old", tracked: false });
    expect(r.output).toContain("untracked");
    expect(r.output).not.toContain("[2J");
    expect(r.output).toContain("eviltext");
  });
  it("--json is a single array with source, scope, agents, mode and tracked", async () => {
    const cwd = tmp(); const home = tmp(); mkdirSync(join(home, ".claude"));
    await installSkill({ name: "a", files, source: "registry:o/a", scope: { global: true, home }, agents: ["claude-code"] });
    const r = runList({ cwd, home, json: true });
    const doc = JSON.parse(r.output) as Array<Record<string, unknown>>;
    expect(doc[0]).toMatchObject({ name: "a", scope: "global", source: "registry:o/a", tracked: true, agents: ["claude-code"] });
  });
  it("prints a hint when nothing is installed", () => {
    expect(runList({ cwd: tmp(), home: tmp() }).output).toMatch(/No installed skills.*skillmd add/);
  });
});
