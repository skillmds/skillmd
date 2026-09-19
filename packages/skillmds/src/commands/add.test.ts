import { describe, it, expect, afterEach, vi } from "vitest";
import { mkdtempSync, mkdirSync, existsSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runAdd, runAddWithUI, addCommand, addFlags, argWithRef, looksLikeProject, resolvePackFiles, registryFallbackNote, registryUnreachableError, fetchPackMembers, packDirNames, fetchPackArchive } from "./add.js";
import type { AddCandidate, AddDeps, AddFlags, AddUI } from "./add.js";
import { IntegrityError, RegistryError } from "../api.js";
import { readLock } from "../lock.js";
import { GLYPH, stripAnsi } from "../ui.js";

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

describe("local directory sources", () => {
  it("installs every file of a local skill dir, not just SKILL.md", async () => {
    const src = join(tmp(), "demo");
    mkdirSync(join(src, "references"), { recursive: true });
    writeFileSync(join(src, "SKILL.md"), VALID);
    writeFileSync(join(src, "references", "a.md"), "A");
    const home = tmp();
    // Real default deps: a local path never touches the network, and the
    // default prompt getters return undefined off a TTY.
    const r = await runAdd(src, { cwd: tmp(), home, global: true, yes: true, agent: ["claude-code"], env: {} });
    expect(r.exitCode).toBe(0);
    expect(readFileSync(join(home, ".agents", "skills", "demo", "references", "a.md"), "utf8")).toBe("A");
  });
});

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
    expect(r.output).toContain("a");
    expect(r.output).toContain("b");
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

describe("--json is a contract", () => {
  const failing = (e: Error): AddDeps => ({ resolve: async () => { throw e; }, fireInstall: () => {} });
  const jsonFlags = (): AddFlags => ({ cwd: tmp(), home: tmp(), global: true, yes: true, json: true, agent: ["claude-code"], env: {} });

  it("turns an integrity failure into one JSON document", async () => {
    const r = await runAdd("o/demo", jsonFlags(), failing(new IntegrityError("bad digest")));
    expect(r.exitCode).toBe(1);
    const doc = JSON.parse(r.output) as { ok: boolean; error: string; blocked: { name: string; reason: string }[] };
    expect(doc.ok).toBe(false);
    expect(doc.error).toContain("bad digest");
    expect(doc.blocked[0]?.name).toBe("o/demo");
  });

  it("turns any other resolve failure into one JSON document", async () => {
    const r = await runAdd("o/demo", jsonFlags(), failing(new Error("registry down")));
    expect(r.exitCode).toBe(1);
    const doc = JSON.parse(r.output) as { ok: boolean; error: string };
    expect(doc.ok).toBe(false);
    expect(doc.error).toContain("registry down");
  });

  it("still rethrows a resolve failure in human mode (the top-level handler prints it)", async () => {
    const flags = { ...jsonFlags(), json: false };
    await expect(runAdd("o/demo", flags, failing(new Error("registry down")))).rejects.toThrow("registry down");
  });

  it("carries human-only notices as plain-text warnings", async () => {
    const home = tmp();
    const r = await runAdd(
      "o/p",
      { cwd: home, home, global: true, yes: true, json: true, agent: ["claude-code"], env: {} },
      depsReturning([{ name: "p", raw: VALID, slug: "p", pinMiss: true }]),
    );
    const doc = JSON.parse(r.output) as { ok: boolean; warnings: string[] };
    expect(doc.ok).toBe(true);
    expect(doc.warnings[0]).toMatch(/pinned commit/);
    // Warnings are consumed by programs: plain text, never ANSI-coloured.
    expect(doc.warnings[0]).not.toContain(String.fromCharCode(27));
  });

  it("--json --list emits a skills document", async () => {
    const home = tmp();
    const r = await runAdd("o/pack", { cwd: tmp(), home, global: true, list: true, json: true, env: {} }, depsReturning([tracked("a"), tracked("b")]));
    expect(r.exitCode).toBe(0);
    const doc = JSON.parse(r.output) as { ok: boolean; skills: { name: string; description: string }[] };
    expect(doc.ok).toBe(true);
    expect(doc.skills.map((s) => s.name)).toEqual(["a", "b"]);
    expect(doc.skills[0]?.description).toContain("demo skill");
    expect(existsSync(join(home, ".agents"))).toBe(false);
  });
});

describe("provenance", () => {
  it("records the parsed source when the resolver left a candidate unattributed", async () => {
    const home = tmp();
    const r = await runAdd(
      "o/n",
      { cwd: tmp(), home, global: true, yes: true, agent: ["claude-code"], env: {} },
      depsReturning([{ name: "n", raw: VALID, slug: "n" }]),
    );
    expect(r.exitCode).toBe(0);
    expect(readLock({ global: true, home }).skills.n?.source).toBe("registry:o/n");
  });
});

describe("argWithRef", () => {
  it("folds --ref back into a GitHub shorthand resolveSource can parse", () => {
    expect(argWithRef("o/r/sub@skill", "v2")).toBe("github:o/r/sub#v2@skill");
  });
  it("leaves a local path exactly as the user typed it", () => {
    expect(argWithRef("./local", "v2")).toBe("./local");
  });
  it("leaves an argument alone when no --ref was passed", () => {
    expect(argWithRef("o/r/sub@skill")).toBe("o/r/sub@skill");
  });
});

describe("--mode copy", () => {
  it("copies into each agent dir instead of linking", async () => {
    const home = tmp();
    mkdirSync(join(home, ".claude"));
    const r = await runAdd(
      "o/demo",
      { cwd: tmp(), home, global: true, yes: true, json: true, mode: "copy", agent: ["claude-code"], env: {} },
      depsReturning([tracked("demo")]),
    );
    const doc = JSON.parse(r.output) as { installed: { targets: { agent: string; mode: string }[] }[] };
    expect(doc.installed[0]?.targets.find((t) => t.agent === "claude-code")?.mode).toBe("copy");
  });

  it("the hidden --copy alias still means --mode copy, and says so in its description", () => {
    const cmd = addCommand();
    cmd.parseOptions(["--copy"]);
    expect(addFlags(cmd.opts()).mode).toBe("copy");
    const copy = cmd.options.find((o) => o.long === "--copy");
    expect(copy?.description).toMatch(/--mode copy/);
  });
});

describe("--force and untracked directories", () => {
  it("refuses an untracked canonical dir without --force and replaces it with one", async () => {
    const home = tmp();
    mkdirSync(join(home, ".agents", "skills", "x"), { recursive: true });
    writeFileSync(join(home, ".agents", "skills", "x", "SKILL.md"), VALID);
    const base: AddFlags = { cwd: tmp(), home, global: true, yes: true, agent: ["claude-code"], env: {} };
    const refused = await runAdd("o/x", base, depsReturning([tracked("x")]));
    expect(refused.exitCode).toBe(1);
    expect(refused.blocked[0]?.reason).toMatch(/not tracked/);
    const ok = await runAdd("o/x", { ...base, force: true }, depsReturning([tracked("x")]));
    expect(ok.exitCode).toBe(0);
  });
});

describe("human output", () => {
  it("names the provenance the install was recorded under", async () => {
    const home = tmp();
    const r = await runAdd("o/demo", { cwd: tmp(), home, global: true, yes: true, agent: ["claude-code"], env: {} }, depsReturning([tracked("demo")]));
    expect(r.exitCode).toBe(0);
    expect(stripAnsi(r.output)).toContain("from registry:o/demo");
  });

  it("prints the replaced line exactly once under --force", async () => {
    const home = tmp();
    mkdirSync(join(home, ".agents", "skills", "x"), { recursive: true });
    writeFileSync(join(home, ".agents", "skills", "x", "SKILL.md"), VALID);
    const r = await runAdd(
      "o/x",
      { cwd: tmp(), home, global: true, yes: true, agent: ["claude-code"], force: true, env: {} },
      depsReturning([tracked("x")]),
    );
    expect(r.exitCode).toBe(0);
    const plain = stripAnsi(r.output);
    expect(plain.match(/replaced previous install/g)).toHaveLength(1);
    expect(plain).toContain(`${GLYPH.replaced} replaced previous install`);
  });
});

describe("runAddWithUI framing", () => {
  // A recording stand-in for clack: the only thing under test is the ORDER the
  // frame is drawn in — an install document printed after the outro lands
  // outside the box, which is the bug this guards.
  function recorder(): { calls: string[]; ui: AddUI } {
    const calls: string[] = [];
    return {
      calls,
      ui: {
        intro: () => { calls.push("intro"); },
        spinner: () => ({ start: () => { calls.push("spinner.start"); }, stop: () => { calls.push("spinner.stop"); } }),
        message: (m) => { calls.push(`message:${stripAnsi(m)}`); },
        outro: (m) => { calls.push(`outro:${stripAnsi(m)}`); },
        cancel: (m) => { calls.push(`cancel:${stripAnsi(m)}`); },
      },
    };
  }

  const tty = { stdinTTY: true, stdoutTTY: true, env: {} };

  it("prints the install document inside the frame: intro → message → outro", async () => {
    const { calls, ui } = recorder();
    const { run, printed } = await runAddWithUI(
      "o/demo",
      { cwd: tmp(), home: tmp(), global: true, agent: ["claude-code"], env: {} },
      { ui, term: tty, deps: depsReturning([tracked("demo")]) },
    );
    expect(run.exitCode).toBe(0);
    expect(printed).toBe(true);
    const framed = calls.filter((c) => !c.startsWith("spinner"));
    expect(framed[0]).toBe("intro");
    expect(framed[1]).toContain("message:");
    expect(framed[1]).toContain("demo");
    expect(framed[2]).toMatch(/^outro:Done\./);
    expect(framed).toHaveLength(3);
  });

  it("closes the frame with cancel() — and prints no document — when the user backs out", async () => {
    const { calls, ui } = recorder();
    const deps: AddDeps = { ...depsReturning([tracked("demo")]), promptScope: async () => null };
    const { run, printed } = await runAddWithUI(
      "o/demo",
      { cwd: tmp(), home: tmp(), agent: ["claude-code"], env: {} },
      { ui, term: tty, deps },
    );
    expect(run.cancelled).toBe(true);
    expect(printed).toBe(true);
    const framed = calls.filter((c) => !c.startsWith("spinner"));
    expect(framed[0]).toBe("intro");
    expect(framed[1]).toBe("cancel:Installation cancelled — nothing was installed.");
    expect(framed).toHaveLength(2);
  });

  it("still shows the document before a failing outro", async () => {
    const { calls, ui } = recorder();
    const { run } = await runAddWithUI(
      "o/bad",
      { cwd: tmp(), home: tmp(), global: true, agent: ["claude-code"], env: {} },
      { ui, term: tty, deps: depsReturning([{ name: "bad", raw: BROKEN, slug: "bad" }]) },
    );
    expect(run.exitCode).toBe(1);
    const framed = calls.filter((c) => !c.startsWith("spinner"));
    expect(framed[0]).toBe("intro");
    expect(framed[1]).toContain("blocked");
    expect(framed[2]).toBe("outro:Some skills were not installed.");
  });

  it("prints nothing itself when the run is not interactive", async () => {
    const { calls, ui } = recorder();
    const { run, printed } = await runAddWithUI(
      "o/demo",
      { cwd: tmp(), home: tmp(), global: true, yes: true, agent: ["claude-code"], env: {} },
      { ui, term: { stdinTTY: false, stdoutTTY: false, env: {} }, deps: depsReturning([tracked("demo")]) },
    );
    expect(run.exitCode).toBe(0);
    expect(printed).toBe(false);
    expect(calls).toEqual([]);
  });
});

describe("defaultNeedsPrompt in a real run", () => {
  it("exits 1 with the -y hint when a scope decision has nobody to answer it", async () => {
    // vitest runs with a piped stdin, so this is the real non-interactive path:
    // no scope flag, no -y, no host agent, no prompt getter in deps.
    const r = await runAdd("o/demo", { cwd: tmp(), home: tmp(), env: {} }, depsReturning([tracked("demo")]));
    expect(r.exitCode).toBe(1);
    expect(r.output).toMatch(/-y/);
    expect(r.written).toHaveLength(0);
  });
});


describe("plugin (pack:) resolution", () => {
  // `/api/packs` pages at 200 and the site has already shipped the bug where
  // page one was treated as the whole plugin, so walking to item_total is the
  // behaviour worth pinning.
  const pagedApi = (total: number) => {
    const calls: string[] = [];
    const api = (async (path: string) => {
      calls.push(path);
      const q = new URL(path, "https://x").searchParams;
      const offset = Number(q.get("offset") ?? 0);
      const limit = Number(q.get("limit") ?? 200);
      const items = Array.from({ length: Math.max(0, Math.min(limit, total - offset)) }, (_, i) => ({ slug: `o/s${offset + i}`, type: "single", verified: false }));
      return { name: "Frontend UI", item_total: total, items };
    }) as never;
    return { api, calls };
  };

  it("returns every member of a single-page plugin", async () => {
    const { api, calls } = pagedApi(3);
    const got = await fetchPackMembers(api, "skillmd", "frontend-ui");
    expect(got.members.map((m) => m.slug)).toEqual(["o/s0", "o/s1", "o/s2"]);
    expect(got.name).toBe("Frontend UI");
    expect(calls).toHaveLength(1);
  });

  it("pages past the 200 limit instead of stopping at page one", async () => {
    const { api, calls } = pagedApi(450);
    const got = await fetchPackMembers(api, "skillmd", "big");
    expect(got.members).toHaveLength(450);
    expect(new Set(got.members.map((m) => m.slug)).size).toBe(450);
    expect(calls).toHaveLength(3); // 200 + 200 + 50
  });

  it("stops rather than spinning when the server returns no rows", async () => {
    const api = (async () => ({ name: "x", item_total: 99, items: [] })) as never;
    await expect(fetchPackMembers(api, "o", "s")).resolves.toEqual({ name: "x", members: [] });
  });

  // The archive names directories by skill name, disambiguating collisions with
  // the owner. Mapping entries back to slugs depends on reproducing that exactly.
  it("reproduces the server's archive directory naming", () => {
    expect(packDirNames(["a/pdf", "b/docx"])).toEqual(["pdf", "docx"]);
    expect(packDirNames(["a/pdf", "b/pdf"])).toEqual(["pdf", "b-pdf"]);
  });

  it("reads every SKILL.md out of one archive request", async () => {
    const { zipSync, strToU8 } = await import("fflate");
    const zip = zipSync({ "pdf/SKILL.md": strToU8("# PDF"), "docx/SKILL.md": strToU8("# DOCX"), "README.md": strToU8("x") });
    let calls = 0;
    const doFetch = (async () => { calls++; return new Response(zip, { status: 200 }); }) as unknown as typeof fetch;
    const got = await fetchPackArchive("https://api.example", "skillmd", "office", undefined, doFetch);
    expect(calls).toBe(1); // one request for the whole plugin, not one per member
    expect(got.get("pdf")).toBe("# PDF");
    expect(got.get("docx")).toBe("# DOCX");
    expect(got.has("README.md")).toBe(false);
  });

  it("surfaces an archive failure as a registry error", async () => {
    const doFetch = (async () => new Response("nope", { status: 404 })) as unknown as typeof fetch;
    await expect(fetchPackArchive("https://api.example", "o", "s", undefined, doFetch)).rejects.toThrow(/404/);
  });
});

// ---------------------------------------------------------------------------
// The managed-plugin path. This is where `plugin:owner/slug` stops being a
// bundle of skills and becomes a real Claude Code plugin, and both ways of
// getting it wrong were shipped once: a success that still downloaded the
// member archive nobody needed (and failed the run on a 429), and a failure
// that dumped loose skills with no word about why.
// ---------------------------------------------------------------------------
vi.mock("../claudePlugin.js", async (orig) => ({
  ...(await orig<typeof import("../claudePlugin.js")>()),
  claudeCliAvailable: async () => claudeStub.available,
  installClaudePlugin: async () => claudeStub.result,
}));
const claudeStub: { available: boolean; result: { ok: true; name: string; marketplace: string } | { ok: false; reason: string } } = {
  available: true,
  result: { ok: true, name: "design@skillmd", marketplace: "skillmd" },
};

describe("plugin: sources install as Claude Code plugins", () => {
  it("stops after the managed install when Claude Code is the only agent here", async () => {
    const cwd = tmp();
    mkdirSync(join(cwd, ".claude", "skills"), { recursive: true });
    claudeStub.available = true;
    claudeStub.result = { ok: true, name: "design@skillmd", marketplace: "skillmd" };
    let resolved = 0;
    const run = await runAdd("plugin:skillmd/design", { ...sameHome(cwd), yes: true, project: true }, {
      resolve: async () => { resolved++; return []; },
      fireInstall: () => {},
    });
    // The plugin is already installed; fetching its members would be a download
    // for nobody — and the registry answers artifact floods with a 429, which
    // used to turn a successful install into exit 1.
    expect(resolved).toBe(0);
    expect(run.exitCode).toBe(0);
    expect(stripAnsi(run.output)).toContain("design@skillmd");
    expect(existsSync(join(cwd, ".claude", "skills", "good"))).toBe(false);
  });

  it("still installs the skills for every other agent", async () => {
    const cwd = tmp();
    mkdirSync(join(cwd, ".claude", "skills"), { recursive: true });
    mkdirSync(join(cwd, ".cursor", "skills"), { recursive: true });
    claudeStub.available = true;
    claudeStub.result = { ok: true, name: "design@skillmd", marketplace: "skillmd" };
    const run = await runAdd("plugin:skillmd/design", { ...sameHome(cwd), yes: true, project: true },
      depsReturning([{ name: "good", raw: GOOD, slug: "good" }]));
    const out = stripAnsi(run.output);
    // Cursor has no plugin system, so it gets the skill …
    expect(existsSync(join(cwd, ".cursor", "skills", "good"))).toBe(true);
    // … and Claude Code must not get the same content twice, once managed and
    // once as a loose skill.
    expect(existsSync(join(cwd, ".claude", "skills", "good"))).toBe(false);
    expect(out).toContain("design@skillmd");
  });

  it("says why it fell back instead of silently dumping skills", async () => {
    const cwd = tmp();
    mkdirSync(join(cwd, ".claude", "skills"), { recursive: true });
    claudeStub.available = true;
    claudeStub.result = { ok: false, reason: 'Plugin "design" not found in marketplace "skillmd"' };
    const run = await runAdd("plugin:skillmd/design", { ...sameHome(cwd), yes: true, project: true },
      depsReturning([{ name: "good", raw: GOOD, slug: "good" }]));
    const out = stripAnsi(run.output);
    expect(out).toContain("not found in marketplace");
    // The fallback is the whole point of the fallback: the skills still land.
    expect(existsSync(join(cwd, ".claude", "skills", "good"))).toBe(true);
  });

  it("says nothing when there is no Claude Code to manage the plugin", async () => {
    const cwd = tmp();
    mkdirSync(join(cwd, ".cursor", "skills"), { recursive: true });
    claudeStub.available = false;
    const run = await runAdd("plugin:skillmd/design", { ...sameHome(cwd), yes: true, project: true },
      depsReturning([{ name: "good", raw: GOOD, slug: "good" }]));
    // Not a failure — there is nothing to manage the plugin, so skills are the
    // right answer and a warning would be noise on every non-Claude machine.
    expect(stripAnsi(run.output)).not.toContain("could not install");
    expect(existsSync(join(cwd, ".cursor", "skills", "good"))).toBe(true);
  });
});
