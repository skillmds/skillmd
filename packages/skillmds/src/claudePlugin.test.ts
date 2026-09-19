import { describe, it, expect } from "vitest";
import { installClaudePlugin, installPluginNatively, claudeCliAvailable, marketplacePluginName, resolveClaudeBin, MARKETPLACE_URL } from "./claudePlugin.js";
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ok = (stdout: string) => async () => ({ stdout, stderr: "" });

describe("claude plugin driver", () => {
  it("reports success from the output, not the exit code", async () => {
    const calls: string[][] = [];
    const exec = async (file: string, args: string[]) => {
      calls.push([file, ...args]);
      return { stdout: args[1] === "marketplace" ? "already on disk" : "Successfully installed plugin: docs-writing@skillmd", stderr: "" };
    };
    const res = await installClaudePlugin("skillmd", "docs-writing", { exec });
    expect(res).toEqual({ ok: true, name: "docs-writing@skillmd", marketplace: "skillmd" });
    // The marketplace is added every time: it is idempotent, so probing first
    // would be an extra call that can itself fail.
    expect(calls[0]).toEqual(["claude", "plugin", "marketplace", "add", MARKETPLACE_URL]);
    // `add` keeps an existing copy, however old; the registry gains plugins
    // daily, so a refresh runs before the install or yesterday's cache decides
    // whether today's plugin exists.
    expect(calls[1]).toEqual(["claude", "plugin", "marketplace", "update", "skillmd"]);
    expect(calls[2]).toEqual(["claude", "plugin", "install", "docs-writing@skillmd"]);
  });

  it("installs anyway when the refresh fails", async () => {
    // A refresh needs the network; the cached marketplace may still hold the
    // plugin, so a failed update must not cost the user the managed install.
    const exec = async (_f: string, args: string[]) => {
      if (args[1] === "marketplace" && args[2] === "update") throw new Error("offline");
      return { stdout: args[1] === "install" ? "Successfully installed plugin: x@skillmd" : "", stderr: "" };
    };
    expect((await installClaudePlugin("skillmd", "x", { exec })).ok).toBe(true);
  });

  // The real CLI exits 0 on this, which is the trap the whole module is built
  // around: a community plugin is not in the curated marketplace.
  it("treats 'not found in marketplace' as a failure despite exit 0", async () => {
    const exec = ok('Installing plugin "x@skillmd"...✘ Failed to install plugin "x@skillmd": Plugin "x" not found in marketplace "skillmd"');
    const res = await installClaudePlugin("skillmd", "x", { exec });
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.reason).toMatch(/not found in marketplace/);
  });

  it("fails softly when claude is not installed", async () => {
    const exec = async () => { throw new Error("spawn claude ENOENT"); };
    expect(await claudeCliAvailable({ exec })).toBe(false);
    const res = await installClaudePlugin("skillmd", "x", { exec });
    expect(res.ok).toBe(false);
  });

  it("does not claim success on unrecognised output", async () => {
    const res = await installClaudePlugin("skillmd", "x", { exec: ok("something else entirely") });
    expect(res.ok).toBe(false);
  });
});

describe("marketplace plugin names", () => {
  // Must match pluginName() in the site's pluginBundle.ts. A mismatch does not
  // error — it resolves to "not found in marketplace" and falls back silently.
  it("keeps the bare slug for curated plugins", () => {
    expect(marketplacePluginName("skillmd", "docs-writing")).toBe("docs-writing");
    expect(marketplacePluginName("SkillMD", "docs-writing")).toBe("docs-writing");
  });
  it("namespaces community plugins with their owner", () => {
    expect(marketplacePluginName("aliyun", "alibabacloud-aiops-skills")).toBe("aliyun-alibabacloud-aiops-skills");
  });
  it("kebab-cases both halves, as Claude Code requires", () => {
    expect(marketplacePluginName("Acme_Corp", "My Plugin!")).toBe("acme-corp-my-plugin");
    expect(marketplacePluginName("acme", "---")).toBe("acme-plugin");
  });
});

describe("locating the claude binary", () => {
  const win = process.platform === "win32";
  const dir = mkdtempSync(join(tmpdir(), "claudebin-"));

  it("honours an explicit override", () => {
    const f = join(dir, "my-claude");
    writeFileSync(f, "");
    expect(resolveClaudeBin({ SKILLMD_CLAUDE_BIN: f } as NodeJS.ProcessEnv)).toBe(f);
    expect(resolveClaudeBin({ SKILLMD_CLAUDE_BIN: join(dir, "nope") } as NodeJS.ProcessEnv)).toBeNull();
  });

  // The case that silently cost every npm-installed Windows user the managed
  // path: the binary is claude.cmd, and a bare "claude" is not executable.
  it.runIf(win)("finds claude.cmd via PATHEXT on Windows", () => {
    const d = mkdtempSync(join(tmpdir(), "cmdpath-"));
    writeFileSync(join(d, "claude.cmd"), "");
    const got = resolveClaudeBin({ PATH: d, PATHEXT: ".COM;.EXE;.BAT;.CMD" } as NodeJS.ProcessEnv);
    expect(got).toBe(join(d, "claude.cmd"));
  });

  it("returns null when nothing is installed", () => {
    const empty = mkdtempSync(join(tmpdir(), "emptypath-"));
    mkdirSync(join(empty, "sub"), { recursive: true });
    expect(resolveClaudeBin({ PATH: join(empty, "sub"), HOME: empty, USERPROFILE: empty } as NodeJS.ProcessEnv)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The install that does not need `claude` on PATH. This is the path that turns
// "the app is installed but the binary is not exported" from a silent pile of
// loose skills into a real plugin.
// ---------------------------------------------------------------------------
describe("installing without the claude binary", () => {
  const zip = (files: Record<string, string>) => {
    const { zipSync, strToU8 } = require("fflate") as typeof import("fflate");
    return zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])));
  };
  const serving = (bytes: Uint8Array, status = 200) =>
    (async () => ({ ok: status === 200, status, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) })) as unknown as typeof fetch;

  const archive = () => zip({
    ".claude-plugin/plugin.json": JSON.stringify({ name: "design", version: "2.1.0" }),
    "README.md": "# Design",
    "skills/ads/SKILL.md": "---\nname: ads\n---\nbody",
  });

  function home(): string {
    const d = mkdtempSync(join(tmpdir(), "skillmd-native-"));
    mkdirSync(join(d, ".claude"), { recursive: true });
    return d;
  }

  it("writes the plugin and the three records Claude Code reads", async () => {
    const h = home();
    const res = await installPluginNatively("skillmd", "design", { home: h, fetch: serving(archive()) });
    expect(res).toEqual({ ok: true, name: "design@skillmd", marketplace: "skillmd" });
    // The archive's own version decides the cache path, as it would if Claude
    // Code had unpacked it.
    const base = join(h, ".claude", "plugins", "cache", "skillmd", "design", "2.1.0");
    expect(readFileSync(join(base, "skills", "ads", "SKILL.md"), "utf8")).toContain("name: ads");
    const installed = JSON.parse(readFileSync(join(h, ".claude", "plugins", "installed_plugins.json"), "utf8"));
    expect(installed.plugins["design@skillmd"][0]).toMatchObject({ scope: "user", version: "2.1.0", installPath: base });
    const settings = JSON.parse(readFileSync(join(h, ".claude", "settings.json"), "utf8"));
    expect(settings.enabledPlugins["design@skillmd"]).toBe(true);
    expect(settings.extraKnownMarketplaces.skillmd.source.url).toBe(MARKETPLACE_URL);
    expect(JSON.parse(readFileSync(join(h, ".claude", "plugins", "known_marketplaces.json"), "utf8")).skillmd.source.url).toBe(MARKETPLACE_URL);
  });

  it("keeps every setting it does not own", async () => {
    const h = home();
    writeFileSync(join(h, ".claude", "settings.json"), JSON.stringify({
      model: "opus", enabledPlugins: { "other@elsewhere": true }, permissions: { allow: ["Bash"] },
    }));
    await installPluginNatively("skillmd", "design", { home: h, fetch: serving(archive()) });
    const s = JSON.parse(readFileSync(join(h, ".claude", "settings.json"), "utf8"));
    // These files belong to Claude Code: an install must not cost the user
    // their model, their permissions, or somebody else's plugin.
    expect(s.model).toBe("opus");
    expect(s.permissions.allow).toEqual(["Bash"]);
    expect(s.enabledPlugins).toEqual({ "other@elsewhere": true, "design@skillmd": true });
  });

  it("refuses rather than overwrite a settings file it cannot parse", async () => {
    const h = home();
    writeFileSync(join(h, ".claude", "settings.json"), "{ this is not json");
    const res = await installPluginNatively("skillmd", "design", { home: h, fetch: serving(archive()) });
    expect(res.ok).toBe(false);
    expect(readFileSync(join(h, ".claude", "settings.json"), "utf8")).toBe("{ this is not json");
  });

  it("replaces its own record instead of stacking copies", async () => {
    const h = home();
    await installPluginNatively("skillmd", "design", { home: h, fetch: serving(archive()) });
    await installPluginNatively("skillmd", "design", { home: h, fetch: serving(archive()) });
    const installed = JSON.parse(readFileSync(join(h, ".claude", "plugins", "installed_plugins.json"), "utf8"));
    expect(installed.plugins["design@skillmd"]).toHaveLength(1);
  });

  it("does not invent a Claude Code install that is not there", async () => {
    const h = mkdtempSync(join(tmpdir(), "skillmd-nohome-"));
    const res = await installPluginNatively("skillmd", "design", { home: h, fetch: serving(archive()) });
    expect(res.ok === false && res.reason).toMatch(/no Claude Code directory/);
  });

  it("namespaces a community plugin the same way the marketplace does", async () => {
    const h = home();
    const res = await installPluginNatively("younis", "cc", { home: h, fetch: serving(archive()) });
    expect(res.ok === true && res.name).toBe("younis-cc@skillmd");
  });
});
