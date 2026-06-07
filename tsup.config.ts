import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/cli.ts"],
    format: ["esm"],
    dts: false,
    clean: false,
    banner: { js: "#!/usr/bin/env node\n" },
  },
  {
    entry: ["src/index.ts"],
    format: ["esm"],
    dts: true,
    clean: true,
  },
]);
