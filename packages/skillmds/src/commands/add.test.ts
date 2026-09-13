import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, existsSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runAdd, looksLikeProject, resolvePackFiles, registryFallbackNote, registryUnreachableError } from "./add.js";
import type { AddCandidate, AddDeps } from "./add.js";
import { RegistryError } from "../api.js";
import { readLock } from "../lock.js";

const tmps: string[] = [];
function tmp(): string { const d = mkdtempSync(join(tmpdir(), "skillmd-add-")); tmps.push(d); return d; }
afterEach(() => { for (const d of tmps.splice(0)) rmSync(d, { recursive: true, force: true }); });

const BROKEN = "---\nname: bad\n---\nbody"; // missing description → lint error
const GOOD = `---
name: good
description: A complete skill that explains how to do a genuinely useful thing.
license: MIT
---
# Good

${"Plenty of detailed body content well past two hundred characters in total. ".repeat(3)}
`;

// `env: {}` keeps every run hermetic: the real CLAUDECODE / CI / DO_NOT_TRACK of
// the machine running the suite must not change scope, prompting or telemetry.
const sameHome = (d: string) => ({ cwd: d, home: d, env: {} });

function depsReturning(candidates: AddCandidate[]): AddDeps {
  return { resolve: async () => candidates, fireInstall: () => {} };
}

describe("runAdd lint gate", () => {
  it("refuses to write a skill with lint errors and exits 1", async () => {
    const cwd = tmp();
    const run = await runAdd("x", { agent: ["claude-code"], ...sameHome(cwd) }, depsReturning([{ name: "bad", raw: BROKEN, slug: "bad" }]));
    expect(run.exitCode).toBe(1);
    expect(run.written).toHaveLength(0);
    expect(existsSync(join(cwd, ".claude", "skills", "bad"))).toBe(false);
  });

  it("writes when --skip-lint is set", async () => {
    const cwd = tmp();
    const run = await runAdd("x", { agent: ["claude-code"], ...sameHome(cwd), skipLint: true }, depsReturning([{ name: "bad", raw: BROKEN, slug: "bad" }]));
    expect(run.exitCode).toBe(0);
    expect(existsSync(join(cwd, ".claude", "skills", "bad", "SKILL.md"))).toBe(true);
  });

  it("writes a clean skill and blocks denied security flags", async () => {
    const cwd = tmp();
    const ok = await runAdd("x", { agent: ["claude-code"], ...sameHome(cwd) }, depsReturning([{ name: "good", raw: GOOD, slug: "good" }]));
    expect(ok.written).toHaveLength(1);

    const denied = await runAdd(
      "x",
      { agent: ["claude-code"], ...sameHome(tmp()), deny: ["network_calls"] },
      depsReturning([{ name: "good", raw: GOOD + "\nSee https://example.com for details.\n", slug: "good" }]),
    );
    expect(denied.exitCode).toBe(1);
    expect(denied.blocked[0]?.reason).toContain("network_calls");
  });

  it("installs unverified registry skills without any gate or flag", async () => {
    const cwd = tmp();
    const run = await runAdd("o/n", { agent: ["claude-code"], ...sameHome(cwd) }, depsReturning([{ name: "good", raw: GOOD, slug: "good", registrySlug: "o/n", verified: false, securityFlags: ["network_calls"] }]));
    expect(run.exitCode).toBe(0);
    expect(run.written).toHaveLength(1);
    expect(run.blocked).toHaveLength(0);
  });
});

const VALID = `---\nname: demo\ndescription: A perfectly fine demo skill for testing installs.\n---\n\n# Demo\n\n${"body ".repeat(50)}`;

describe("pack installs", () => {
  it("writes every file of a pack candidate", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "skillmd-pack-"));
    const deps: AddDeps = {
      resolve: async () => [{
        name: "seo-plan", raw: VALID, slug: "seo-plan", registrySlug: "o/seo-plan",
        verified: true, type: "pack",
        files: [
          { path: "SKILL.md", contents: VALID },
          { path: "assets/saas.md", contents: "# SaaS template" },
        ],
      }],
      fireInstall: () => {},
    };
    const r = await runAdd("o/seo-plan", { ...sameHome(cwd) }, deps);
    expect(r.written).toHaveLength(1);
    const dir = r.written[0]!.dir;
    expect(readFileSync(join(dir, "assets", "saas.md"), "utf8")).toContain("SaaS template");
  });
  it("warns when the pinned commit was unavailable and the default branch was used", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "skillmd-pack-"));
    const deps: AddDeps = {
      resolve: async () => [{
        name: "seo-plan", raw: VALID, slug: "seo-plan", registrySlug: "o/seo-plan",
        verified: true, type: "pack", pinMiss: true,
        files: [
          { path: "SKILL.md", contents: VALID },
          { path: "assets/saas.md", contents: "# SaaS template" },
        ],
      }],
      fireInstall: () => {},
    };
    const r = await runAdd("o/seo-plan", { ...sameHome(cwd) }, deps);
    expect(r.written).toHaveLength(1);
    expect(r.output).toMatch(/pinned commit unavailable/i);
    expect(r.output).not.toMatch(/only SKILL\.md/i);
  });
  it("warns loudly when a pack has no fetchable files", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "skillmd-pack-"));
    const deps: AddDeps = {
      resolve: async () => [{ name: "p", raw: VALID, slug: "p", registrySlug: "o/p", verified: true, type: "pack" }],
      fireInstall: () => {},
    };
    const r = await runAdd("o/p", { ...sameHome(cwd) }, deps);
    expect(r.output).toMatch(/pack.*only SKILL\.md/i);
  });
});

describe("resolvePackFiles degrade order", () => {
  const skill = { source_repo: "https://github.com/o/r/tree/main/skills/p", commit_sha: "a".repeat(40) };
  const tree = (paths: string[]) => paths.map((p) => ({ path: p, contents: Buffer.from(p === "SKILL.md" ? VALID : "asset") }));

  it("uses the pinned commit when it resolves", async () => {
    const refs: (string | undefined)[] = [];
    const r = await resolvePackFiles(skill, async (_url, ref) => { refs.push(ref); return tree(["SKILL.md", "assets/a.md"]); });
    expect(refs).toEqual([skill.commit_sha]);
    expect(r?.pinMiss).toBe(false);
    expect(r?.files.map((f) => f.path)).toEqual(["SKILL.md", "assets/a.md"]);
    expect(r?.raw).toBe(VALID);
  });

  it("retries the default branch when the pin is gone, and flags pinMiss", async () => {
    const refs: (string | undefined)[] = [];
    const r = await resolvePackFiles(skill, async (_url, ref) => {
      refs.push(ref);
      if (ref) throw new Error("404");
      return tree(["SKILL.md"]);
    });
    expect(refs).toEqual([skill.commit_sha, undefined]);
    expect(r?.pinMiss).toBe(true);
  });

  it("returns null when both attempts fail (caller falls back to the registry copy)", async () => {
    const r = await resolvePackFiles(skill, async () => { throw new Error("offline"); });
    expect(r).toBeNull();
  });

  it("advances past a tree with no SKILL.md and falls back to null if none has one", async () => {
    const refs: (string | undefined)[] = [];
    const r = await resolvePackFiles(skill, async (_url, ref) => { refs.push(ref); return tree(["README.md"]); });
    expect(refs).toEqual([skill.commit_sha, undefined]);
    expect(r).toBeNull();
  });

  it("does not retry when no commit_sha was pinned", async () => {
    const refs: (string | undefined)[] = [];
    const r = await resolvePackFiles({ ...skill, commit_sha: null }, async (_url, ref) => { refs.push(ref); throw new Error("offline"); });
    expect(refs).toEqual([undefined]);
    expect(r).toBeNull();
  });
});

describe("unreachable registry diagnostics", () => {
  it("prints a resolve note as a warning line after a successful install", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "skillmd-add-"));
    const note = registryFallbackNote("api.skillmd.com");
    const r = await runAdd("o/demo", { ...sameHome(cwd) }, depsReturning([{ name: "demo", raw: VALID, slug: "demo", note }]));
    expect(r.written).toHaveLength(1);
    expect(r.output).toMatch(/⚠ demo: installed from GitHub because the SkillMD registry/);
    expect(r.output).toMatch(/not the registry-reviewed version/);
  });

  it("names the blocked registry — not the GitHub 404 — when both routes fail", () => {
    const err = registryUnreachableError("anthropic/frontend-design", "api.skillmd.com", new RegistryError("SkillMD API 403 on /api/skills/anthropic/frontend-design: egress denied", 403));
    expect(err.message).toContain("could not reach the SkillMD registry at api.skillmd.com (HTTP 403)");
    expect(err.message).toContain("allow api.skillmd.com");
    expect(err.message).toContain("MCP server");
    expect(err.message).toContain("egress denied");
  });

  it("describes network-level failures without inventing an HTTP status", () => {
    const err = registryUnreachableError("o/n", "api.skillmd.com", new RegistryError("could not reach https://api.skillmd.com: getaddrinfo ENOTFOUND"));
    expect(err.message).toContain("(network error)");
    expect(err.message).toContain("ENOTFOUND");
  });
});

describe("verification never gates installs", () => {
  const unverifiedDeps = (): AddDeps => ({
    resolve: async () => [{ name: "demo", raw: VALID, slug: "demo", registrySlug: "o/demo", verified: false, securityFlags: ["network_calls"] }],
    fireInstall: () => {},
  });

  it("installs an unverified, flagged skill directly — no flag, no prompt", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "skillmd-add-"));
    const r = await runAdd("o/demo", { ...sameHome(cwd) }, unverifiedDeps());
    expect(r.written).toHaveLength(1);
    expect(r.exitCode).toBe(0);
    expect(r.blocked).toHaveLength(0);
  });
  it("shows the security flags on the success line as information", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "skillmd-add-"));
    const r = await runAdd("o/demo", { ...sameHome(cwd) }, unverifiedDeps());
    expect(r.output).toContain("network_calls");
    expect(r.output).not.toMatch(/blocked|not yet verified/i);
  });
  it("still honors an explicit --deny", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "skillmd-add-"));
    const r = await runAdd("o/demo", { ...sameHome(cwd), deny: ["network_calls"] }, unverifiedDeps());
    expect(r.written).toHaveLength(0);
    expect(r.blocked[0]?.reason).toContain("network_calls");
  });
});

describe("install scope", () => {
  const demo = [{ name: "demo", raw: VALID, slug: "demo" }];

  // -y is what selects the auto-detect rule now: without it (and without a TTY
  // or a host agent) a missing scope flag is an error, not a guess.
  it("falls back to the user-level dirs when the cwd is not a project (never litters a stray folder)", async () => {
    const cwd = tmp();
    const home = tmp();
    const r = await runAdd("o/demo", { agent: ["claude-code"], cwd, home, yes: true, env: {} }, depsReturning(demo));
    expect(r.exitCode).toBe(0);
    expect(existsSync(join(home, ".claude", "skills", "demo", "SKILL.md"))).toBe(true);
    expect(existsSync(join(cwd, ".claude"))).toBe(false);
    expect(r.output).toContain("no project detected");
    expect(r.output).toContain("--project");
  });

  it("installs into the project when the cwd carries a project marker", async () => {
    const cwd = tmp();
    const home = tmp();
    mkdirSync(join(cwd, ".git"));
    const r = await runAdd("o/demo", { agent: ["claude-code"], cwd, home, yes: true, env: {} }, depsReturning(demo));
    expect(existsSync(join(cwd, ".claude", "skills", "demo", "SKILL.md"))).toBe(true);
    expect(existsSync(join(home, ".claude"))).toBe(false);
    expect(r.output).not.toContain("no project detected");
  });

  it("treats an existing agent dot-dir as a project marker", () => {
    const cwd = tmp();
    expect(looksLikeProject(cwd)).toBe(false);
    mkdirSync(join(cwd, ".cursor"));
    expect(looksLikeProject(cwd)).toBe(true);
  });

  it("--project forces the cwd even without markers", async () => {
    const cwd = tmp();
    const home = tmp();
    await runAdd("o/demo", { agent: ["claude-code"], cwd, home, project: true, env: {} }, depsReturning(demo));
    expect(existsSync(join(cwd, ".claude", "skills", "demo", "SKILL.md"))).toBe(true);
  });

  it("asks the user when a prompt is available and honours the answer", async () => {
    const cwd = tmp();
    const home = tmp();
    const seen: { cwd: string; suggestGlobal: boolean }[] = [];
    const deps: AddDeps = { ...depsReturning(demo), promptScope: async (ctx) => { seen.push(ctx); return true; } };
    await runAdd("o/demo", { agent: ["claude-code"], cwd, home, env: {} }, deps);
    expect(seen).toHaveLength(1);
    expect(seen[0]!.suggestGlobal).toBe(true);
    expect(existsSync(join(home, ".claude", "skills", "demo", "SKILL.md"))).toBe(true);
    expect(existsSync(join(cwd, ".claude"))).toBe(false);
  });

  it("does not prompt with -y or --json, and never when a scope flag is given", async () => {
    const cwd = tmp();
    const home = tmp();
    let asked = 0;
    const deps: AddDeps = { ...depsReturning(demo), promptScope: async () => { asked++; return false; } };
    await runAdd("o/demo", { agent: ["claude-code"], cwd, home, yes: true, env: {} }, deps);
    await runAdd("o/demo", { agent: ["claude-code"], cwd, home, json: true, env: {} }, deps);
    await runAdd("o/demo", { agent: ["claude-code"], cwd, home, global: true, env: {} }, deps);
    expect(asked).toBe(0);
  });

  it("cancelling the prompt writes nothing and exits 0", async () => {
    const cwd = tmp();
    const home = tmp();
    const deps: AddDeps = { ...depsReturning(demo), promptScope: async () => null };
    const r = await runAdd("o/demo", { agent: ["claude-code"], cwd, home, env: {} }, deps);
    expect(r.cancelled).toBe(true);
    expect(r.exitCode).toBe(0);
    expect(r.written).toHaveLength(0);
    expect(existsSync(join(cwd, ".claude"))).toBe(false);
    expect(existsSync(join(home, ".claude"))).toBe(false);
    // Not even the canonical copy — a cancelled scope prompt writes nothing at all.
    expect(existsSync(join(home, ".agents"))).toBe(false);
    expect(existsSync(join(cwd, ".agents"))).toBe(false);
  });

  it("lets the user narrow the detected agents", async () => {
    const cwd = tmp();
    const home = tmp();
    mkdirSync(join(home, ".claude"));
    mkdirSync(join(home, ".cursor"));
    const deps: AddDeps = { ...depsReturning(demo), promptAgents: async ({ detected }) => detected.filter((a) => a === "cursor") };
    const r = await runAdd("o/demo", { cwd, home, global: true, env: {} }, deps);
    expect(r.written.map((w) => w.dir)).toEqual([join(home, ".cursor", "skills", "demo")]);
    expect(existsSync(join(home, ".claude", "skills"))).toBe(false);
  });
});

const tracked = (name: string, source = `registry:o/${name}`): AddCandidate => ({ name, raw: VALID, slug: name, source, registrySlug: `o/${name}` });

describe("add on the installer", () => {
  it("writes the canonical copy, links agents, records the lock", async () => {
    const home = tmp();
    mkdirSync(join(home, ".claude")); mkdirSync(join(home, ".cursor"));
    const r = await runAdd("o/demo", { cwd: tmp(), home, global: true, yes: true, env: {} }, depsReturning([tracked("demo")]));
    expect(r.exitCode).toBe(0);
    expect(existsSync(join(home, ".agents", "skills", "demo", "SKILL.md"))).toBe(true);
    expect(existsSync(join(home, ".claude", "skills", "demo", "SKILL.md"))).toBe(true);
    expect(readLock({ global: true, home }).skills.demo?.source).toBe("registry:o/demo");
    expect(r.output).toMatch(/demo/);
    expect(r.output).toMatch(/claude-code/);
  });

  it("project install does not litter: only agents already present get a dir", async () => {
    const cwd = tmp(); const home = tmp();
    mkdirSync(join(cwd, ".git")); mkdirSync(join(cwd, ".claude"));
    mkdirSync(join(home, ".claude")); mkdirSync(join(home, ".cursor")); mkdirSync(join(home, ".kiro"));
    const r = await runAdd("o/demo", { cwd, home, yes: true, env: {} }, depsReturning([tracked("demo")]));
    expect(r.exitCode).toBe(0);
    expect(existsSync(join(cwd, ".claude", "skills", "demo"))).toBe(true);
    expect(existsSync(join(cwd, ".cursor"))).toBe(false);
    expect(existsSync(join(cwd, ".kiro"))).toBe(false);
    expect(r.output).toMatch(/cursor.*not present in this project/);
  });

  it("exits 1 when any candidate is blocked, even if others were written", async () => {
    const home = tmp();
    const r = await runAdd("o/p", { cwd: tmp(), home, global: true, yes: true, agent: ["claude-code"], env: {} },
      depsReturning([tracked("good"), { name: "bad", raw: BROKEN, slug: "bad", source: "registry:o/bad" }]));
    expect(r.written).toHaveLength(1);
    expect(r.blocked).toHaveLength(1);
    expect(r.exitCode).toBe(1);
  });

  it("refuses to replace a differently-sourced skill without --force and says so", async () => {
    const home = tmp();
    await runAdd("./x", { cwd: tmp(), home, global: true, yes: true, agent: ["claude-code"], env: {} }, depsReturning([tracked("n", "local:/x")]));
    const r = await runAdd("o/n", { cwd: tmp(), home, global: true, yes: true, agent: ["claude-code"], env: {} }, depsReturning([tracked("n")]));
    expect(r.exitCode).toBe(1);
    expect(r.blocked[0]?.reason).toMatch(/--force/);
    const ok = await runAdd("o/n", { cwd: tmp(), home, global: true, yes: true, agent: ["claude-code"], force: true, env: {} }, depsReturning([tracked("n")]));
    expect(ok.exitCode).toBe(0);
  });

  it("--json returns one document with targets, skipped and blocked; nothing else on stdout", async () => {
    const home = tmp();
    const r = await runAdd("o/demo", { cwd: tmp(), home, global: true, yes: true, json: true, agent: ["claude-code"], env: {} }, depsReturning([tracked("demo")]));
    const doc = JSON.parse(r.output) as { ok: boolean; installed: { name: string; targets: { agent: string; mode: string }[] }[]; blocked: unknown[] };
    expect(doc.ok).toBe(true);
    expect(doc.installed[0]?.name).toBe("demo");
    expect(doc.installed[0]?.targets[0]?.agent).toBe("claude-code");
  });

  it("--json without -y is refused", async () => {
    const r = await runAdd("o/demo", { cwd: tmp(), home: tmp(), json: true, env: {} }, depsReturning([tracked("demo")]));
    expect(r.exitCode).toBe(1);
    expect(JSON.parse(r.output)).toMatchObject({ ok: false, error: expect.stringContaining("-y") });
  });

  it("--list previews the skills in a source without writing", async () => {
    const home = tmp();
    const r = await runAdd("o/pack", { cwd: tmp(), home, global: true, list: true, env: {} }, depsReturning([tracked("a"), tracked("b")]));
    expect(r.written).toHaveLength(0);
    expect(r.output).toMatch(/a[\s\S]*b/);
    expect(existsSync(join(home, ".agents"))).toBe(false);
  });

  it("a needed prompt with no TTY exits 1 with a hint instead of cancelling silently", async () => {
    const r = await runAdd("o/demo", { cwd: tmp(), home: tmp(), env: {} }, { ...depsReturning([tracked("demo")]), needsPrompt: true });
    expect(r.exitCode).toBe(1);
    expect(r.output).toMatch(/-y/);
  });

  it("inside a host agent (CLAUDECODE) a missing scope flag auto-detects instead of failing", async () => {
    const home = tmp(); mkdirSync(join(home, ".claude"));
    const r = await runAdd("o/demo", { cwd: tmp(), home, agent: ["claude-code"], env: { CLAUDECODE: "1" } }, depsReturning([tracked("demo")]));
    expect(r.exitCode).toBe(0);
    expect(existsSync(join(home, ".agents", "skills", "demo", "SKILL.md"))).toBe(true);
  });

  it("skips the install-count POST when telemetry is disabled", async () => {
    const fired: string[] = [];
    const deps: AddDeps = { ...depsReturning([tracked("demo")]), fireInstall: (s) => fired.push(s) };
    await runAdd("o/demo", { cwd: tmp(), home: tmp(), global: true, yes: true, agent: ["claude-code"], env: { DO_NOT_TRACK: "1" } }, deps);
    expect(fired).toEqual([]);
    await runAdd("o/demo2", { cwd: tmp(), home: tmp(), global: true, yes: true, agent: ["claude-code"], env: {} }, { ...deps, resolve: async () => [tracked("demo2")] });
    expect(fired).toEqual(["o/demo2"]);
  });

  it("project-only agents are skipped in global scope instead of crashing", async () => {
    const home = tmp(); mkdirSync(join(home, ".eve")); mkdirSync(join(home, ".claude"));
    const r = await runAdd("o/demo", { cwd: tmp(), home, global: true, yes: true, env: {} }, depsReturning([tracked("demo")]));
    expect(r.exitCode).toBe(0);
    expect(r.output).toMatch(/eve.*project-only/);
  });

  it("looksLikeProject recognises legacy agent roots via projectRoots (.codex, .kilocode)", () => {
    const cwd = tmp(); mkdirSync(join(cwd, ".codex"));
    expect(looksLikeProject(cwd)).toBe(true);
    const cwd2 = tmp(); mkdirSync(join(cwd2, ".kilocode"));
    expect(looksLikeProject(cwd2)).toBe(true);
  });
});
