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
import { promisify } from "node:util";

const run = promisify(execFile);

/** Where the marketplace manifest lives. Kept here so the CLI never has to be
 *  told the site's address by a caller that might pass a preview origin. */
export const MARKETPLACE_URL = "https://skillmd.com/.claude-plugin/marketplace.json";
export const MARKETPLACE_NAME = "skillmd";

export interface ClaudePluginDeps {
  /** Injected in tests. Resolves with the command's output, rejects if it cannot run. */
  exec?: (file: string, args: string[]) => Promise<{ stdout: string; stderr: string }>;
}

export type PluginInstallOutcome =
  | { ok: true; name: string; marketplace: string }
  | { ok: false; reason: string };

const TIMEOUT_MS = 120_000;

function exec(deps: ClaudePluginDeps) {
  return deps.exec ?? ((file: string, args: string[]) =>
    run(file, args, { timeout: TIMEOUT_MS, windowsHide: true }).then((r) => ({
      stdout: String(r.stdout ?? ""), stderr: String(r.stderr ?? ""),
    })));
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
