import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runUpdate } from "./update.js";
import type { UpdateDeps } from "./update.js";
import { installSkill, digestOf } from "../installer.js";
import { readLock } from "../lock.js";

const tmps: string[] = [];
const tmp = () => { const d = mkdtempSync(join(tmpdir(), "skillmd-up-")); tmps.push(d); return d; };
afterEach(() => { for (const d of tmps.splice(0)) rmSync(d, { recursive: true, force: true }); });

const v1 = [{ path: "SKILL.md", contents: "---\nname: a\ndescription: A useful description of version one.\n---\n" + "body ".repeat(60) }, { path: "ref.md", contents: "one" }];
const v2 = [{ path: "SKILL.md", contents: "---\nname: a\ndescription: A useful description of version two.\n---\n" + "body ".repeat(60) }];

function deps(latest: Record<string, typeof v1 | Error>): UpdateDeps & { fetched: string[] } {
  const fetched: string[] = [];
  return {
    fetched,
    fetchLatest: async (source) => { fetched.push(source); const r = latest[source]; if (!r) return null; if (r instanceof Error) throw r; return { files: r, commit_sha: "def" }; },
  };
}

describe("runUpdate", () => {
  it("re-fetches by lock source, replaces the full bundle (stale companions vanish), updates the digest", async () => {
    const home = tmp(); mkdirSync(join(home, ".claude"));
    await installSkill({ name: "a", files: v1, source: "registry:o/a", scope: { global: true, home }, agents: ["claude-code"] });
    const d = deps({ "registry:o/a": v2 });
    const r = await runUpdate([], { global: true, home, yes: true }, d);
    expect(r.exitCode).toBe(0);
    expect(d.fetched).toEqual(["registry:o/a"]);
    expect(readFileSync(join(home, ".agents", "skills", "a", "SKILL.md"), "utf8")).toContain("version two");
    expect(existsSync(join(home, ".agents", "skills", "a", "ref.md"))).toBe(false);
    expect(readLock({ global: true, home }).skills.a?.digest).toBe(digestOf(v2));
    expect(r.output).toMatch(/✓ a/);
  });
  it("reports up-to-date skills without rewriting", async () => {
    const home = tmp(); mkdirSync(join(home, ".claude"));
    await installSkill({ name: "a", files: v1, source: "registry:o/a", scope: { global: true, home }, agents: ["claude-code"] });
    const r = await runUpdate([], { global: true, home, yes: true }, deps({ "registry:o/a": v1 }));
    expect(r.updated).toEqual([]);
    expect(r.output).toMatch(/a.*up to date/);
    expect(r.exitCode).toBe(0);
  });
  it("skips untracked skills with a reinstall hint and never guesses by name", async () => {
    const home = tmp();
    mkdirSync(join(home, ".claude", "skills", "old"), { recursive: true });
    writeFileSync(join(home, ".claude", "skills", "old", "SKILL.md"), v1[0]!.contents);
    const d = deps({});
    const r = await runUpdate([], { global: true, home, yes: true }, d);
    expect(d.fetched).toEqual([]);
    expect(r.output).toMatch(/old.*untracked.*skillmd add/);
    expect(r.exitCode).toBe(0);
  });
  it("--check lists available updates and writes nothing; exit 0", async () => {
    const home = tmp(); mkdirSync(join(home, ".claude"));
    await installSkill({ name: "a", files: v1, source: "registry:o/a", scope: { global: true, home }, agents: ["claude-code"] });
    const r = await runUpdate([], { global: true, home, yes: true, check: true }, deps({ "registry:o/a": v2 }));
    expect(r.exitCode).toBe(0);
    expect(r.output).toMatch(/a.*update available/);
    expect(readFileSync(join(home, ".agents", "skills", "a", "SKILL.md"), "utf8")).toContain("version one");
  });
  it("a failed fetch, a lint failure, or an upstream deletion exits 1 with the cause", async () => {
    const home = tmp(); mkdirSync(join(home, ".claude"));
    await installSkill({ name: "a", files: v1, source: "registry:o/a", scope: { global: true, home }, agents: ["claude-code"] });
    await installSkill({ name: "b", files: v1.map((f) => ({ ...f })), source: "registry:o/b", scope: { global: true, home }, agents: ["claude-code"] });
    const r = await runUpdate([], { global: true, home, yes: true }, deps({ "registry:o/a": new Error("boom 503") }));
    expect(r.exitCode).toBe(1);
    expect(r.output).toMatch(/a.*boom 503/);
    expect(r.output).toMatch(/b.*no longer available upstream/);
  });
  it("updates both scopes by default, only the selected one with -g/-p", async () => {
    const cwd = tmp(); const home = tmp(); mkdirSync(join(home, ".claude")); mkdirSync(join(cwd, ".claude"));
    await installSkill({ name: "p", files: v1, source: "registry:o/p", scope: { cwd, home }, agents: ["claude-code"] });
    await installSkill({ name: "g", files: v1, source: "registry:o/g", scope: { global: true, home }, agents: ["claude-code"] });
    const both = deps({ "registry:o/p": v2, "registry:o/g": v2 });
    await runUpdate([], { cwd, home, yes: true }, both);
    expect(both.fetched.sort()).toEqual(["registry:o/g", "registry:o/p"]);
    const onlyP = deps({ "registry:o/p": v2, "registry:o/g": v2 });
    await runUpdate([], { cwd, home, yes: true, project: true }, onlyP);
    expect(onlyP.fetched).toEqual(["registry:o/p"]);
  });
});
