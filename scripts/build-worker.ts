import { build } from "esbuild";
await build({
  entryPoints: {
    worker: "src/worker/index.ts",
    "bootstrap-admin": "scripts/bootstrap-admin.ts",
    "recover-account": "scripts/recover-account.ts",
    "provision-user": "scripts/provision-user.ts",
    "restore-check": "scripts/restore-check.ts",
  },
  outdir: "dist",
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  packages: "external",
});
