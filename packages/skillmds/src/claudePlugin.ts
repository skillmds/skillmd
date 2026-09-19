// Install a SkillMD plugin as a *real* Claude Code plugin, by driving Claude
// Code's own `claude plugin` CLI rather than writing skills into agent folders.
//
// The difference matters. Expanding a plugin into its member skills gives you N
// loose directories: nothing records that they arrived together, `/plugin` does
// not list them, and removing the set means removing each one. Going through
// `claude plugin install` registers a single entry in installed_plugins.json,
// lands the content under plugins/cache/<marketplace>/<plugin>/<version>/ with
// its .claude-plugin manifest, and makes the plugin enable/disable/uninstall as
// one unit — the same as any other Claude Code plugin.
//
// We can do this because the site already publishes a marketplace manifest, so
// there is nothing to fabricate: we add that marketplace (idempotent, once per
// machine) and install from it. The user still types one command.
//
// It is not always possible, which is why every failure here is soft — the
// caller falls back to installing the members as ordinary skills:
//   * `claude` may not be on PATH (the user may not use Claude Code at all),
//   * only the curated plugins are listed in the marketplace; a community
//     plugin resolves to "not found in marketplace".
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

/** Where the `claude` binary actually is.
 *
 *  Not just "claude": on Windows an npm-installed Claude Code is `claude.cmd`,
 *  and since the CVE-2024-27980 fix Node refuses to execFile a .cmd without a
 *  shell. Passing the bare name there fails with ENOENT, claudeCliAvailable()
 *  reports false, and every install on that machine quietly takes the fallback
 *  — the exact failure this module exists to avoid, on a large share of Windows
 *  installs. So resolve the real file first, honouring PATHEXT, and fall back
 *  to the paths the native installer uses when PATH has not been reloaded. */
export function resolveClaudeBin(env: NodeJS.ProcessEnv = process.env): string | null {
  const override = env.SKILLMD_CLAUDE_BIN;
  if (override) return existsSync(override) ? override : null;
  const win = process.platform === "win32";
  const exts = win ? (env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";").filter(Boolean) : [""];
  const dirs = (env.PATH ?? "").split(delimiter).filter(Boolean);
  // The native installer drops it here and does not always re-export PATH into
  // an already-open shell. Home comes from the env so a caller that redirects
  // HOME (tests, sandboxes) does not get the real machine's install.
  const home = env.USERPROFILE || env.HOME || homedir();
  dirs.push(join(home, ".local", "bin"), join(home, ".claude", "local"));
  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = join(dir, `claude${ext.toLowerCase()}`);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

/** .cmd/.bat are batch scripts: only a shell can run them. Everything else is
 *  spawned directly. The arguments are a constant URL and a plugin name that
 *  marketplacePluginName() has already reduced to [a-z0-9-], so there is no
 *  string for a shell to reinterpret. */
const needsShell = (bin: string) => /\.(cmd|bat)$/i.test(bin);

/** Where the marketplace manifest lives. Kept here so the CLI never has to be
 *  told the site's address by a caller that might pass a preview origin. */
export const MARKETPLACE_URL = "https://skillmd.com/.claude-plugin/marketplace.json";
export const MARKETPLACE_NAME = "skillmd";
const MARKETPLACE_SCHEMA = "https://anthropic.com/claude-code/marketplace.schema.json";

export interface ClaudePluginDeps {
  /** Injected in tests. Resolves with the command's output, rejects if it cannot run. */
  exec?: (file: string, args: string[]) => Promise<{ stdout: string; stderr: string }>;
}

export type PluginInstallOutcome =
  | { ok: true; name: string; marketplace: string }
  | { ok: false; reason: string };

const TIMEOUT_MS = 120_000;

function exec(deps: ClaudePluginDeps) {
  return deps.exec ?? ((file: string, args: string[]) => {
    const bin = file === "claude" ? resolveClaudeBin() : file;
    if (!bin) return Promise.reject(new Error("claude not found on PATH"));
    return run(bin, args, { timeout: TIMEOUT_MS, windowsHide: true, shell: needsShell(bin) }).then((r) => ({
      stdout: String(r.stdout ?? ""), stderr: String(r.stderr ?? ""),
    }));
  });
}

/** The name a plugin carries in the marketplace manifest.
 *
 *  Mirrors pluginName() in the website's pluginBundle.ts, which is the source
 *  of truth. Claude Code rejects a name that is not kebab-case, and a
 *  marketplace is keyed by name, so two owners sharing a slug would collide —
 *  community plugins are namespaced with their owner, curated ones (owner
 *  `skillmd`) keep the bare slug. Getting this wrong does not error, it just
 *  resolves to "not found in marketplace" and silently falls back, which is
 *  exactly what happened to every community plugin before this existed. */
export function marketplacePluginName(owner: string, slug: string): string {
  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const base = clean(slug) || "plugin";
  return owner.toLowerCase() === "skillmd" ? base : `${clean(owner)}-${base}`;
}

/** Is Claude Code's CLI usable here? */
export async function claudeCliAvailable(deps: ClaudePluginDeps = {}): Promise<boolean> {
  try {
    await exec(deps)("claude", ["--version"]);
    return true;
  } catch {
    return false;
  }
}

/** Install `<slug>@skillmd` through Claude Code.
 *
 *  `claude plugin install` exits 0 even when it fails ("Plugin X not found in
 *  marketplace"), so success is read from the output, never the exit code. */
export async function installClaudePlugin(
  owner: string,
  slug: string,
  deps: ClaudePluginDeps = {},
): Promise<PluginInstallOutcome> {
  const sh = exec(deps);
  const qualified = `${marketplacePluginName(owner, slug)}@${MARKETPLACE_NAME}`;
  try {
    // Idempotent: a second add reports "already on disk" and still exits 0, so
    // this runs unconditionally rather than probing for the marketplace first.
    await sh("claude", ["plugin", "marketplace", "add", MARKETPLACE_URL]);
  } catch (e) {
    return { ok: false, reason: `could not add the SkillMD marketplace: ${msg(e)}` };
  }
  // `add` on a marketplace that is already registered keeps the copy on disk,
  // which may be weeks old — and the registry gains plugins daily. Without this
  // refresh, anyone who added the marketplace before today's plugin existed
  // gets "not found in marketplace" and silently falls back to loose skills.
  // Failure is not fatal: the cached copy may still hold the plugin.
  try {
    await sh("claude", ["plugin", "marketplace", "update", MARKETPLACE_NAME]);
  } catch {
    /* stale is better than stopped */
  }
  let out: string;
  try {
    const r = await sh("claude", ["plugin", "install", qualified]);
    out = `${r.stdout}\n${r.stderr}`;
  } catch (e) {
    return { ok: false, reason: msg(e) };
  }
  if (/Successfully installed plugin/i.test(out)) return { ok: true, name: qualified, marketplace: MARKETPLACE_NAME };
  const failed = /Failed to install plugin[^:]*:\s*(.+)/i.exec(out);
  return { ok: false, reason: (failed?.[1] ?? out).trim().split(/\r?\n/)[0] ?? "install did not report success" };
}

function msg(e: unknown): string {
  if (e && typeof e === "object" && "stderr" in e) {
    const s = String((e as { stderr?: unknown }).stderr ?? "").trim();
    if (s) return s.split(/\r?\n/)[0]!;
  }
  return e instanceof Error ? e.message.split(/\r?\n/)[0]! : String(e);
}

// ---------------------------------------------------------------------------
// The same install, without the `claude` binary.
//
// Driving the official CLI is the sanctioned path, but it needs `claude` to be
// on PATH of the shell that ran `npx`, and on plenty of machines it is not —
// the app is installed, the CLI is not exported, and the user gets a pile of
// loose skills with no idea why. That is the failure this exists to remove.
//
// A Claude Code plugin is not a secret format: it is a directory under
// plugins/cache/<marketplace>/<plugin>/<version>/ plus three JSON records
// saying it is there. We already build that exact directory server-side — it
// is what /plugins/<owner>/<slug>/plugin.zip contains — so installing it is
// unzip plus a careful merge. Careful is the operative word: these files
// belong to Claude Code, so every write reads first, keeps every key it does
// not own, and refuses outright if the existing file does not parse.
// ---------------------------------------------------------------------------

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const SITE_URL = "https://skillmd.com";

export interface NativeDeps {
  fetch?: typeof fetch;
  /** Overridden in tests; otherwise the same home the resolver uses. */
  home?: string;
}

function readJson(path: string): Record<string, unknown> | "absent" | "unparsable" {
  let text: string;
  try { text = readFileSync(path, "utf8"); } catch { return "absent"; }
  try {
    const v = JSON.parse(text);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : "unparsable";
  } catch { return "unparsable"; }
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? { ...(v as Record<string, unknown>) } : {};

/** Install the plugin by writing what Claude Code would have written. */
export async function installPluginNatively(
  owner: string,
  slug: string,
  deps: NativeDeps = {},
): Promise<PluginInstallOutcome> {
  const home = deps.home ?? (process.env.USERPROFILE || process.env.HOME || homedir());
  const claudeDir = join(home, ".claude");
  // No ~/.claude means no Claude Code, and inventing one would put a plugin
  // where nothing reads it. The member skills are the honest answer there.
  if (!existsSync(claudeDir)) return { ok: false, reason: "no Claude Code directory on this machine" };

  const name = marketplacePluginName(owner, slug);
  const qualified = `${name}@${MARKETPLACE_NAME}`;
  const doFetch = deps.fetch ?? fetch;

  let entries: Record<string, Uint8Array>;
  try {
    const res = await doFetch(`${SITE_URL}/plugins/${owner}/${slug}/plugin.zip`, { headers: { accept: "application/zip" } });
    if (!res.ok) return { ok: false, reason: `the plugin archive answered ${res.status}` };
    const { unzipSync } = await import("fflate");
    entries = unzipSync(new Uint8Array(await res.arrayBuffer()));
  } catch (e) {
    return { ok: false, reason: msg(e) };
  }

  // The archive carries its own manifest; its version decides the cache path,
  // exactly as it would if Claude Code had unpacked it.
  let version = "1.0.0";
  const manifest = entries[".claude-plugin/plugin.json"];
  if (manifest) {
    try {
      const v = JSON.parse(new TextDecoder().decode(manifest)) as { version?: unknown };
      if (typeof v.version === "string" && v.version) version = v.version;
    } catch { /* keep the default rather than fail over a cosmetic field */ }
  }
  if (!manifest) return { ok: false, reason: "the plugin archive has no .claude-plugin/plugin.json" };

  const pluginsDir = join(claudeDir, "plugins");
  const installPath = join(pluginsDir, "cache", MARKETPLACE_NAME, name, version);
  const knownPath = join(pluginsDir, "known_marketplaces.json");
  const installedPath = join(pluginsDir, "installed_plugins.json");
  const settingsPath = join(claudeDir, "settings.json");

  // Read every record BEFORE writing anything: a file we cannot parse is a file
  // we must not overwrite, and finding that out halfway leaves a half install.
  const known = readJson(knownPath);
  if (known === "unparsable") return { ok: false, reason: "known_marketplaces.json is not readable JSON — left untouched" };
  const installed = readJson(installedPath);
  if (installed === "unparsable") return { ok: false, reason: "installed_plugins.json is not readable JSON — left untouched" };
  const settings = readJson(settingsPath);
  if (settings === "unparsable") return { ok: false, reason: "settings.json is not readable JSON — left untouched" };

  try {
    for (const [path, data] of Object.entries(entries)) {
      if (path.endsWith("/")) continue;
      const dest = join(installPath, ...path.split("/"));
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, data);
    }
    writeFileSync(join(installPath, ".in_use"), "");

    const now = new Date().toISOString();
    const source = { source: "url", url: MARKETPLACE_URL };

    // Claude Code resolves an installed plugin through its marketplace, and a
    // declaration alone is not enough: with the cache directory empty it
    // reports "Marketplace skillmd failed to load: cache-miss" and the plugin
    // sits in the list as failed. The manifest that would have been fetched
    // therefore gets written too — merged, so a second install does not erase
    // the first one's entry.
    const marketplaceDir = join(pluginsDir, "marketplaces", MARKETPLACE_NAME);
    const cachedPath = join(marketplaceDir, ".claude-plugin", "marketplace.json");
    const cached = readJson(cachedPath);
    if (cached === "unparsable") return { ok: false, reason: "the cached marketplace manifest is not readable JSON — left untouched" };
    const cachedDoc = cached === "absent"
      ? { $schema: MARKETPLACE_SCHEMA, name: MARKETPLACE_NAME, owner: { name: "SkillMD", email: "hi@skillmd.com" },
          description: "Agent Skill plugins from the SkillMD registry.", plugins: [] as Record<string, unknown>[] }
      : cached;
    const list = Array.isArray(cachedDoc.plugins) ? (cachedDoc.plugins as Record<string, unknown>[]) : [];
    cachedDoc.plugins = [
      ...list.filter((e) => e?.name !== name),
      {
        name,
        version,
        homepage: `${SITE_URL}/plugins/${owner}/${slug}`,
        author: { name: owner === "skillmd" ? "SkillMD" : `@${owner}` },
        source: { source: "archive", url: `${SITE_URL}/plugins/${owner}/${slug}/plugin.zip` },
      },
    ];
    writeJson(cachedPath, cachedDoc);

    // A declaration already on disk is left exactly as it is. Claude Code
    // refuses to add a marketplace whose source differs from the declared one,
    // so overwriting somebody's repo-sourced `skillmd` with our URL is how you
    // break their Plugins tab from a CLI install.
    const knownDoc = known === "absent" ? {} : known;
    if (!knownDoc[MARKETPLACE_NAME]) {
      knownDoc[MARKETPLACE_NAME] = { source, installLocation: marketplaceDir, lastUpdated: now };
      writeJson(knownPath, knownDoc);
    }

    const installedDoc = installed === "absent" ? { version: 2, plugins: {} } : installed;
    const plugins = obj(installedDoc.plugins);
    // One record per scope: reinstalling replaces the user-scope entry instead
    // of stacking a second copy of the same plugin.
    const prior = Array.isArray(plugins[qualified]) ? (plugins[qualified] as Record<string, unknown>[]) : [];
    plugins[qualified] = [
      ...prior.filter((p) => p?.scope !== "user"),
      { scope: "user", installPath, version, installedAt: now, lastUpdated: now },
    ];
    installedDoc.plugins = plugins;
    if (typeof installedDoc.version !== "number") installedDoc.version = 2;
    writeJson(installedPath, installedDoc);

    const settingsDoc = settings === "absent" ? {} : settings;
    const declared = obj(settingsDoc.extraKnownMarketplaces);
    if (!declared[MARKETPLACE_NAME]) declared[MARKETPLACE_NAME] = { source };
    settingsDoc.extraKnownMarketplaces = declared;
    settingsDoc.enabledPlugins = { ...obj(settingsDoc.enabledPlugins), [qualified]: true };
    writeJson(settingsPath, settingsDoc);
  } catch (e) {
    return { ok: false, reason: msg(e) };
  }
  return { ok: true, name: qualified, marketplace: MARKETPLACE_NAME };
}
