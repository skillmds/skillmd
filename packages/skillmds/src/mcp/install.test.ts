import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installFromRegistry } from "./install.js";
import type { ToolContext } from "./tools.js";
import { readLock } from "../lock.js";

const tmps: string[] = [];
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), "skillmd-mcpi-"));
  tmps.push(d);
  return d;
};
afterEach(() => {
  for (const d of tmps.splice(0)) rmSync(d, { recursive: true, force: true });
});

const RAW = "---\nname: demo\ndescription: A registry skill used to test the MCP installer.\nlicense: MIT\n---\n\n# Demo\n\n" + "Do the thing. ".repeat(30);
const skill = { slug: "o/demo", title: "Demo", description: "d", raw_md: RAW, type: "single", security_flags: ["docs_only"], commit_sha: "abc" };
const ctx = (home: string, cwd: string): ToolContext => ({
  api: (async (path: string) => {
    if (path === "/api/skills/o/demo") return skill;
    if (path.endsWith("/install")) return {};
    throw new Error(`unexpected ${path}`);
  }) as ToolContext["api"],
  hasToken: false,
  base: "https://api.test",
  cwd,
  home,
  env: { DO_NOT_TRACK: "1" },
});

describe("installFromRegistry", () => {
  it("defaults to project scope when the cwd looks like a project, else global", async () => {
    const home = tmp();
    mkdirSync(join(home, ".claude"));
    const cwd = tmp();
    mkdirSync(join(cwd, ".git"));
    mkdirSync(join(cwd, ".claude"));
    const r = await installFromRegistry({ slug: "o/demo" }, ctx(home, cwd));
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent).toMatchObject({ installed: true, scope: "project" });
    expect(existsSync(join(cwd, ".claude", "skills", "demo", "SKILL.md"))).toBe(true);
    expect(readLock({ global: false, cwd }).skills.demo?.source).toBe("registry:o/demo");

    const stray = tmp();
    const g = await installFromRegistry({ slug: "o/demo" }, ctx(home, stray));
    expect(g.structuredContent).toMatchObject({ scope: "global" });
    expect(existsSync(join(stray, ".claude"))).toBe(false);
    expect(existsSync(join(home, ".agents", "skills", "demo", "SKILL.md"))).toBe(true);
  });

  it("honours scope and agents", async () => {
    const home = tmp();
    mkdirSync(join(home, ".claude"));
    mkdirSync(join(home, ".cursor"));
    const r = await installFromRegistry({ slug: "o/demo", scope: "global", agents: ["cursor"] }, ctx(home, tmp()));
    expect((r.structuredContent as { targets: { agent: string }[] }).targets.map((t) => t.agent)).toEqual(["cursor"]);
  });

  it("accepts a legacy dest only when it is a known agent skills dir", async () => {
    const home = tmp();
    mkdirSync(join(home, ".claude"));
    const ok = await installFromRegistry({ slug: "o/demo", dest: join(home, ".claude", "skills") }, ctx(home, tmp()));
    expect(ok.isError).toBeFalsy();
    const bad = await installFromRegistry({ slug: "o/demo", dest: join(home, ".ssh") }, ctx(home, tmp()));
    expect(bad.isError).toBe(true);
    expect(bad.content[0]!.text).toMatch(/not a known agent skills directory/);
    expect(existsSync(join(home, ".ssh"))).toBe(false);
  });

  it("refuses invalid slugs, denied flags and lint failures without writing", async () => {
    const home = tmp();
    expect((await installFromRegistry({ slug: "../x" }, ctx(home, tmp()))).isError).toBe(true);
    const denied = await installFromRegistry({ slug: "o/demo", scope: "global", deny: ["docs_only"] }, ctx(home, tmp()));
    expect(denied.isError).toBe(true);
    const c = ctx(home, tmp());
    c.api = (async () => ({ ...skill, raw_md: "---\nname: demo\n---\nno description" })) as ToolContext["api"];
    expect((await installFromRegistry({ slug: "o/demo", scope: "global" }, c)).isError).toBe(true);
    expect(existsSync(join(home, ".agents"))).toBe(false);
  });
});
