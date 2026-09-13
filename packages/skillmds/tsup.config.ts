import { defineConfig } from "tsup";

// Two build artifacts sharing one chunk graph:
//   dist/cli.js  the CLI (imported by bin/skillmd.mjs)
//   dist/mcp.js  the MCP server + CLI dispatch (imported by bin/skillmd-mcp.mjs)
// Both live in dist/, so the runtime `new URL("../package.json", import.meta.url)`
// version read resolves to this package's manifest from either entry.
//
// Everything runtime stays external. These are real npm dependencies of this
// package, not vendored bundles — and commander and giget are CommonJS, which
// esbuild can only inline into ESM behind a `require` shim that throws on the
// first `require("events")`. External is both correct and the only thing that
// runs.
export default defineConfig({
  entry: { cli: "src/index.ts", mcp: "src/mcp/index.ts" },
  format: "esm",
  target: "node18",
  outDir: "dist",
  clean: true,
  splitting: true,
  external: ["@skillmds/core", "@modelcontextprotocol/sdk", "commander", "@clack/prompts", "picocolors", "giget"],
});
