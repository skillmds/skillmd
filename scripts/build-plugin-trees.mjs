// Materialise the flagship plugins as real directories in this repo.
//
// Why this exists: Claude Code's Plugins tab (and claude.ai's marketplace
// sync) only understand plugins that live in git — a relative path in the
// marketplace repo, a `github` repo, or a `git-subdir`. They do not implement
// the `archive` source kind, which is what the registry's own manifest uses
// and what the `claude` CLI installs from perfectly well. So adding
// skillmds/skillmd in the tab failed with nothing more specific than
// "Marketplace sync failed" while the same repo worked from the CLI.
//
// The whole curated set as git trees is ~147MB, which is not a thing to put in
// the repo people clone for the CLI. So the flagship plugins are checked in
// here, and the registry's complete manifest — all of it, community included —
// stays one command away:  npx skillmds add plugin:<owner>/<slug>
//
// Usage: node scripts/build-plugin-trees.mjs [count]
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { unzipSync } from "fflate";

const COUNT = Number(process.argv[2] ?? 24);
const SOURCE = "https://skillmd.com/.claude-plugin/marketplace.json";
const ROOT = "plugins";
const OUT = ".claude-plugin/marketplace.json";
const CURATED = "https://skillmd.com/plugins/skillmd/";

const res = await fetch(SOURCE, { headers: { accept: "application/json" } });
if (!res.ok) throw new Error(`${SOURCE} answered ${res.status}`);
const doc = await res.json();
if (doc?.name !== "skillmd" || !Array.isArray(doc.plugins) || doc.plugins.length < 100) {
  throw new Error(`refusing to build from a manifest with ${doc?.plugins?.length} plugins`);
}

// Manifest order is the registry's own: curated first, then by size. The
// flagship plugins are the front of that list.
const chosen = doc.plugins.filter((p) => String(p?.homepage ?? "").startsWith(CURATED)).slice(0, COUNT);
if (!chosen.length) throw new Error("no curated plugins to build");

// Rebuilt from scratch every time: a plugin removed from the registry must not
// linger here, and a renamed skill must not leave its old file behind.
rmSync(ROOT, { recursive: true, force: true });

let bytes = 0;
for (const p of chosen) {
  const zip = await fetch(p.source.url, { headers: { accept: "application/zip" } });
  if (!zip.ok) throw new Error(`${p.name}: archive answered ${zip.status}`);
  const entries = unzipSync(new Uint8Array(await zip.arrayBuffer()));
  let written = 0;
  for (const [path, data] of Object.entries(entries)) {
    if (path.endsWith("/") || path.includes("..")) continue;
    const dest = join(ROOT, p.name, ...path.split("/"));
    try {
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, data);
    } catch (e) {
      // Some upstream archives carry a directory entry with no trailing slash,
      // so a later file wants a directory where a file already sits. One
      // skipped entry is not worth failing a 24-plugin build over.
      console.warn(`  skipped ${p.name}/${path}: ${e.code ?? e.message}`);
      continue;
    }
    written++;
    bytes += data.byteLength;
  }
  console.log(`${p.name}: ${written} files`);
}

// The repo manifest lists exactly what the repo holds. Mixing in `archive`
// entries for everything else is what made the sync fail in the first place.
const manifest = {
  ...doc,
  plugins: chosen.map(({ source: _drop, ...rest }) => ({ ...rest, source: `./${ROOT}/${rest.name}` })),
};
writeFileSync(OUT, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`\n${chosen.length} plugins, ${(bytes / 1e6).toFixed(1)}MB on disk`);
