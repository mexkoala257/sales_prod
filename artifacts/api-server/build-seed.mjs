/**
 * Compiles src/seed.ts into dist/seed.mjs using esbuild.
 * Used by both the Dockerfile and scripts/seed.sh.
 *
 * Run from the artifacts/api-server directory:
 *   node build-seed.mjs
 */
import { createRequire } from "node:module";
import { build } from "esbuild";

// Some esbuild plugins use require()
globalThis.require = createRequire(import.meta.url);

await build({
  entryPoints: ["src/seed.ts"],
  platform: "node",
  bundle: true,
  format: "esm",
  outfile: "dist/seed.mjs",
  external: ["@google-cloud/*", "pg-native", "*.node"],
  banner: {
    js: `import { createRequire as __cr } from 'node:module'; globalThis.require = __cr(import.meta.url);`,
  },
});

console.log("✓ dist/seed.mjs built");
