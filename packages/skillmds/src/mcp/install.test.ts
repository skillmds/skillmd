import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installFromRegistry } from "./install.js";
import type { ToolContext } from "./tools.js";
import { IntegrityError } from "../api.js";
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
/** A context over `record`, which collects every API path the installer calls. */
const ctxWith = (home: string, cwd: string, over: Partial<ToolContext> = {}, record: string[] = []): ToolContext => ({
  api: (async (path: string) => {
    record.push(path);
    if (path === "/api/skills/o/demo") return skill;
    if (path.endsWith("/install")) return {};
    throw new Error(`unexpected ${path}`);
  }) as ToolContext["api"],
  hasToken: false,
  base: "https://api.test",
  cwd,
  home,
  env: { DO_NOT_TRACK: "1" },
  ...over,
});
const ctx = (home: string, cwd: string): ToolContext => ctxWith(home, cwd);

const BAD_RAW = "---\nname: demo\n---\nno description";
const pack = { ...skill, type: "pack", source_repo: "https://github.com/o/demo" };
/** A context that serves the pack record instead of the single-file one. */
const packCtx = (home: string, cwd: string, record: string[] = []): ToolContext =>
  ctxWith(
    home,
    cwd,
    {
      api: (async (path: string) => {
        record.push(path);
        if (path === "/api/skills/o/demo") return pack;
        if (path.endsWith("/install")) return {};
        throw new Error(`unexpected ${path}`);
      }) as ToolContext["api"],
    },
    record,
  );

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

  it("a dest of the cross-agent canonical root writes the canonical copy only", async () => {
    const home = tmp();
    mkdirSync(join(home, ".codex"));
    const r = await installFromRegistry({ slug: "o/demo", dest: join(home, ".agents", "skills") }, ctx(home, tmp()));
    expect(r.isError).toBeFalsy();
    expect((r.structuredContent as { targets: unknown[] }).targets).toEqual([]);
    expect(r.content[0]!.text).toMatch(/canonical only/);
    expect(existsSync(join(home, ".agents", "skills", "demo", "SKILL.md"))).toBe(true);
    expect(existsSync(join(home, ".codex"))).toBe(true);
    expect(existsSync(join(home, ".codex", "skills"))).toBe(false);
  });

  it("refuses dest and agents together rather than guessing which one wins", async () => {
    const home = tmp();
    mkdirSync(join(home, ".claude"));
    const r = await installFromRegistry({ slug: "o/demo", dest: join(home, ".claude", "skills"), agents: ["cursor"] }, ctx(home, tmp()));
    expect(r.isError).toBe(true);
    expect(r.content[0]!.text).toMatch(/either `dest` or `agents`/);
    expect(existsSync(join(home, ".agents"))).toBe(false);
  });

  it("re-lints the SKILL.md the pack fallback actually writes, and refuses a bad one", async () => {
    const home = tmp();
    const r = await installFromRegistry({ slug: "o/demo", scope: "global" }, packCtx(home, tmp()), {
      fetchBundle: async () => null,
      resolvePackFiles: async () => ({ raw: BAD_RAW, files: [{ path: "SKILL.md", contents: BAD_RAW }], pinMiss: true }),
    });
    expect(r.isError).toBe(true);
    expect(r.content[0]!.text).toMatch(/failed validation/);
    expect(existsSync(join(home, ".agents"))).toBe(false);
  });

  it("notes an unpinned pack fallback in the install summary", async () => {
    const home = tmp();
    mkdirSync(join(home, ".claude"));
    const r = await installFromRegistry({ slug: "o/demo", scope: "global" }, packCtx(home, tmp()), {
      fetchBundle: async () => null,
      resolvePackFiles: async () => ({
        raw: RAW,
        files: [
          { path: "SKILL.md", contents: RAW },
          { path: "reference.md", contents: "extra" },
        ],
        pinMiss: true,
      }),
    });
    expect(r.isError).toBeFalsy();
    expect((r.structuredContent as { note?: string }).note).toMatch(/pinned commit/);
    expect((r.structuredContent as { files_written: number }).files_written).toBe(2);
    expect(existsSync(join(home, ".agents", "skills", "demo", "reference.md"))).toBe(true);
  });

  it("refuses a pack that fails integrity verification without writing", async () => {
    const home = tmp();
    const r = await installFromRegistry({ slug: "o/demo", scope: "global" }, packCtx(home, tmp()), {
      fetchBundle: async () => {
        throw new IntegrityError("bad");
      },
    });
    expect(r.isError).toBe(true);
    expect(r.content[0]!.text).toMatch(/integrity/);
    expect(existsSync(join(home, ".agents"))).toBe(false);
  });

  it("counts an install unless telemetry is opted out", async () => {
    const home = tmp();
    mkdirSync(join(home, ".claude"));
    const on: string[] = [];
    await installFromRegistry({ slug: "o/demo", scope: "global" }, ctxWith(home, tmp(), { env: {} }, on));
    expect(on.filter((p) => p.endsWith("/install"))).toEqual(["/api/skills/o/demo/install"]);

    const off: string[] = [];
    await installFromRegistry({ slug: "o/demo", scope: "global", force: true }, ctxWith(home, tmp(), { env: { DO_NOT_TRACK: "1" } }, off));
    expect(off.some((p) => p.endsWith("/install"))).toBe(false);
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
