import { execFile as execFileCallback } from "node:child_process";
import {
  mkdtemp,
  readFile,
  rmdir,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFile = promisify(execFileCallback);
const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const generatorPath = resolve(
  repositoryRoot,
  "scripts/create-cloudflare-config.mjs",
);

async function removeIfPresent(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

async function removeDirectoryIfPresent(path: string): Promise<void> {
  try {
    await rmdir(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

describe("private Cloudflare deployment config", () => {
  it("disables public secondary routes in every generated config", async () => {
    const fixtureRoot = await mkdtemp(
      join(tmpdir(), "rigstage-cloudflare-config-"),
    );
    const generatedDirectory = join(fixtureRoot, ".wrangler");
    const generatedPath = join(generatedDirectory, "deploy.jsonc");
    const templatePath = join(fixtureRoot, "wrangler.jsonc");

    try {
      await writeFile(
        templatePath,
        JSON.stringify({
          $schema: "./node_modules/wrangler/config-schema.json",
          name: "replace-with-worker-name",
          main: "./src/worker/index.ts",
          assets: { directory: "./dist", binding: "ASSETS" },
          d1_databases: [{ binding: "DB", migrations_dir: "./migrations" }],
          r2_buckets: [{ binding: "PRIVATE_ASSETS" }],
          ratelimits: [
            {
              name: "PILOT_RATE_LIMITER",
              namespace_id: "1",
              simple: { limit: 60, period: 60 },
            },
          ],
          workflows: [
            {
              name: "replace-with-workflow-name",
              binding: "ASSET_GENERATION",
              class_name: "AssetGenerationWorkflow",
            },
          ],
        }),
      );

      await execFile(process.execPath, [generatorPath], {
        cwd: fixtureRoot,
        env: {
          RIGSTAGE_D1_DATABASE_ID: "synthetic-d1-id",
          RIGSTAGE_D1_DATABASE_NAME: "rigstage-test-db",
          RIGSTAGE_R2_BUCKET_NAME: "rigstage-test-assets",
          RIGSTAGE_WORKFLOW_NAME: "rigstage-test-workflow",
          RIGSTAGE_RATE_NAMESPACE_ID: "123",
          RIGSTAGE_WORKER_NAME: "rigstage-test-worker",
        },
      });

      const generated = JSON.parse(
        await readFile(generatedPath, "utf8"),
      ) as Record<string, unknown>;
      const generatedMode = (await stat(generatedPath)).mode & 0o777;

      expect(generated).toMatchObject({
        workers_dev: false,
        preview_urls: false,
        name: "rigstage-test-worker",
      });
      expect(generatedMode).toBe(0o600);
    } finally {
      await removeIfPresent(generatedPath);
      await removeDirectoryIfPresent(generatedDirectory);
      await removeIfPresent(templatePath);
      await removeDirectoryIfPresent(fixtureRoot);
    }
  });
});
