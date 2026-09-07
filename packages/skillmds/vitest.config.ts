import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    // Unit tests run against core's TypeScript source so no build is needed.
    // (The MCP smoke test spawns the real bin, which resolves the built
    // @skillmds/core package — the root `test` script builds core first.)
    alias: { "@skillmds/core": fileURLToPath(new URL("../core/src/index.ts", import.meta.url)) },
  },
  test: { globals: true, environment: "node" },
});
