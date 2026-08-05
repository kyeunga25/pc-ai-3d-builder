import path from "node:path";

import {
  cloudflareTest,
  readD1Migrations,
} from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  const migrations = await readD1Migrations(
    path.join(import.meta.dirname, "migrations"),
  );

  return {
    plugins: [
      cloudflareTest({
        main: "./src/worker/index.ts",
        miniflare: {
          compatibilityDate: "2026-08-01",
          compatibilityFlags: ["nodejs_compat"],
          bindings: {
            GENERATION_MODE: "simulation",
            GENERATION_MAX_COST_MINOR: "0",
            TEST_MIGRATIONS: migrations,
          },
          d1Databases: ["DB"],
          r2Buckets: ["PRIVATE_ASSETS"],
          workflows: {
            ASSET_GENERATION: {
              name: "rigstage-local-generation-test",
              className: "AssetGenerationWorkflow",
            },
          },
        },
      }),
    ],
    test: {
      include: ["test-worker/**/*.test.ts"],
      setupFiles: ["./test-worker/apply-migrations.ts"],
      testTimeout: 20_000,
    },
  };
});
