import { defineConfig } from "tsup";

// Library build: ESM + type declarations. Dependencies (yaml) stay external —
// nothing is bundled, so consumers' resolvers handle CJS/ESM interop natively.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node18",
  dts: true,
  sourcemap: true,
  clean: true,
});
