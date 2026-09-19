// Rewrite .claude-plugin/marketplace.json from the published registry manifest.
//
// Run by .github/workflows/marketplace.yml; safe to run by hand.
//
// Two constraints shape what lands here:
//   * Claude Code's Plugins tab reads this file through the GitHub contents
//     API, which returns NO content for a file over 1MB — the app then shows a
//     bare "Failed to add marketplace". The full roster is 3.2MB, so the repo
//     copy carries the curated plugins only. Everything else stays installable
//     with `skillmds add plugin:<owner>/<slug>`, which reads the complete
//     manifest from the site.
//   * A truncated or error body must never reach the default branch, or every
//     plugin in the tab disappears until the next run. Hence the floor check.
import { writeFileSync } from "node:fs";

const SOURCE = "https://skillmd.com/.claude-plugin/marketplace.json";
const OUT = ".claude-plugin/marketplace.json";
const CURATED = "https://skillmd.com/plugins/skillmd/";
const LIMIT = 900_000; // a margin under GitHub's 1MB contents ceiling

const res = await fetch(SOURCE, { headers: { accept: "application/json" } });
if (!res.ok) throw new Error(`${SOURCE} answered ${res.status}`);
const doc = await res.json();

if (doc?.name !== "skillmd" || !Array.isArray(doc.plugins) || doc.plugins.length < 100) {
  throw new Error(`refusing to commit a manifest with ${doc?.plugins?.length} plugins`);
}
doc.plugins = doc.plugins.filter((p) => String(p?.homepage ?? "").startsWith(CURATED));
if (!doc.plugins.length) throw new Error("no curated plugins in the manifest");

const out = `${JSON.stringify(doc, null, 2)}\n`;
if (Buffer.byteLength(out) > LIMIT) {
  throw new Error(`manifest is ${Buffer.byteLength(out)} bytes — too close to GitHub's 1MB contents limit`);
}
writeFileSync(OUT, out);
console.log(`${OUT}: ${doc.plugins.length} plugins, ${Buffer.byteLength(out)} bytes`);
