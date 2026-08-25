import { defineConfig } from "tsup";

// One build artifact: dist/cli.js (the CLI, imported by both bin shims).
// Everything runtime stays external — including @skillmd/core, which is a
// real npm dependency of this package rather than a vendored bundle.
export default defineConfig({
  entry: { cli: "src/index.ts" },
  format: "esm",
  target: "node18",
  outDir: "dist",
  clean: true,
  external: ["@skillmd/core", "commander", "@clack/prompts", "picocolors", "yaml", "giget"],
});
