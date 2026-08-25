import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, existsSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runAdd, resolvePackFiles, registryFallbackNote, registryUnreachableError } from "./add.js";
import type { AddCandidate, AddDeps } from "./add.js";
import { RegistryError } from "../api.js";

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

function depsReturning(candidates: AddCandidate[]): AddDeps {
  return { resolve: async () => candidates, fireInstall: () => {} };
}

describe("runAdd lint gate", () => {
  it("refuses to write a skill with lint errors and exits 1", async () => {
    const cwd = tmp();
    const run = await runAdd("x", { agent: ["claude-code"], cwd }, depsReturning([{ name: "bad", raw: BROKEN, slug: "bad" }]));
    expect(run.exitCode).toBe(1);
    expect(run.written).toHaveLength(0);
    expect(existsSync(join(cwd, ".claude", "skills", "bad"))).toBe(false);
  });

  it("writes when --skip-lint is set", async () => {
    const cwd = tmp();
    const run = await runAdd("x", { agent: ["claude-code"], cwd, skipLint: true }, depsReturning([{ name: "bad", raw: BROKEN, slug: "bad" }]));
    expect(run.exitCode).toBe(0);
    expect(existsSync(join(cwd, ".claude", "skills", "bad", "SKILL.md"))).toBe(true);
  });

  it("writes a clean skill and blocks denied security flags", async () => {
    const cwd = tmp();
    const ok = await runAdd("x", { agent: ["claude-code"], cwd }, depsReturning([{ name: "good", raw: GOOD, slug: "good" }]));
    expect(ok.written).toHaveLength(1);

    const denied = await runAdd(
      "x",
      { agent: ["claude-code"], cwd: tmp(), deny: ["network_calls"] },
      depsReturning([{ name: "good", raw: GOOD + "\nSee https://example.com for details.\n", slug: "good" }]),
    );
    expect(denied.exitCode).toBe(1);
    expect(denied.blocked[0]?.reason).toContain("network_calls");
  });

  it("installs unverified registry skills without any gate or flag", async () => {
    const cwd = tmp();
    const run = await runAdd("o/n", { agent: ["claude-code"], cwd }, depsReturning([{ name: "good", raw: GOOD, slug: "good", registrySlug: "o/n", verified: false, securityFlags: ["network_calls"] }]));
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
    const r = await runAdd("o/seo-plan", { cwd, home: cwd }, deps);
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
    const r = await runAdd("o/seo-plan", { cwd, home: cwd }, deps);
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
    const r = await runAdd("o/p", { cwd, home: cwd }, deps);
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
    const r = await runAdd("o/demo", { cwd, home: cwd }, depsReturning([{ name: "demo", raw: VALID, slug: "demo", note }]));
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
    const r = await runAdd("o/demo", { cwd, home: cwd }, unverifiedDeps());
    expect(r.written).toHaveLength(1);
    expect(r.exitCode).toBe(0);
    expect(r.blocked).toHaveLength(0);
  });
  it("shows the security flags on the success line as information", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "skillmd-add-"));
    const r = await runAdd("o/demo", { cwd, home: cwd }, unverifiedDeps());
    expect(r.output).toContain("network_calls");
    expect(r.output).not.toMatch(/blocked|not yet verified/i);
  });
  it("still honors an explicit --deny", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "skillmd-add-"));
    const r = await runAdd("o/demo", { cwd, home: cwd, deny: ["network_calls"] }, unverifiedDeps());
    expect(r.written).toHaveLength(0);
    expect(r.blocked[0]?.reason).toContain("network_calls");
  });
});
