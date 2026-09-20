import { build } from "esbuild";
await build({
  entryPoints: ["server.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  packages: "external",
  sourcemap: false,
  outfile: "dist/server.cjs"
});
