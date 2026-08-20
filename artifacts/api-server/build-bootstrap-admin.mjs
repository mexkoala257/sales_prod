/**
 * Compiles the clean-install super-admin bootstrap command.
 * Run from the artifacts/api-server directory:
 *   node build-bootstrap-admin.mjs
 */
import { createRequire } from "node:module";
import { build } from "esbuild";

globalThis.require = createRequire(import.meta.url);

await build({
  entryPoints: ["src/bootstrap-admin.ts"],
  platform: "node",
  bundle: true,
  format: "esm",
  outfile: "dist/bootstrap-admin.mjs",
  external: ["@google-cloud/*", "pg-native", "*.node"],
  banner: {
    js: `import { createRequire as __cr } from 'node:module'; globalThis.require = __cr(import.meta.url);`,
  },
});

console.log("✓ dist/bootstrap-admin.mjs built");