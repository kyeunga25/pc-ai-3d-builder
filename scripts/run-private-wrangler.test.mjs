import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  PrivateWranglerError,
  privateWranglerArguments,
  privateWranglerEnvironment,
  runCapturedPrivateCommand,
} from "./run-private-wrangler.mjs";

test("private Wrangler environment drops deployment coordinates", () => {
  const privateValues = {
    RIGSTAGE_D1_DATABASE_ID: "private-database-id",
    RIGSTAGE_D1_DATABASE_NAME: "private-database-name",
    RIGSTAGE_R2_BUCKET_NAME: "private-bucket-name",
    RIGSTAGE_WORKFLOW_NAME: "private-workflow-name",
    RIGSTAGE_RATE_NAMESPACE_ID: "123456",
    RIGSTAGE_WORKER_NAME: "private-worker-name",
    WRANGLER_CI_OVERRIDE_NAME: "private-override-name",
    CLOUDFLARE_API_TOKEN: "required-runtime-secret",
  };
  const environment = privateWranglerEnvironment(privateValues);

  for (const name of Object.keys(privateValues).filter(
    (name) =>
      name.startsWith("RIGSTAGE_") || name === "WRANGLER_CI_OVERRIDE_NAME",
  )) {
    assert.equal(environment[name], undefined);
  }
  assert.equal(environment.CLOUDFLARE_API_TOKEN, "required-runtime-secret");
  assert.equal(environment.WRANGLER_SEND_METRICS, "false");
});

test("private Wrangler arguments use only the ignored config coordinate", () => {
  const configPath = "/private/repository/.wrangler/deploy.jsonc";
  assert.deepEqual(privateWranglerArguments("migrate", configPath), [
    "d1",
    "migrations",
    "apply",
    "DB",
    "--remote",
    "--config",
    configPath,
  ]);
  assert.deepEqual(privateWranglerArguments("deploy", configPath), [
    "deploy",
    "--config",
    configPath,
  ]);
});

test("captured child output is never returned or printed", () => {
  let options;
  const result = runCapturedPrivateCommand("wrangler", ["deploy"], {
    environment: { CLOUDFLARE_API_TOKEN: "runtime-secret" },
    spawn: (_command, _args, receivedOptions) => {
      options = receivedOptions;
      return {
        status: 0,
        stdout: "private-worker private-database-id",
        stderr: "private-route.example.invalid",
      };
    },
  });

  assert.equal(result, undefined);
  assert.deepEqual(options.stdio, ["ignore", "pipe", "pipe"]);
});

test("captured child failures expose only a stable generic code", () => {
  assert.throws(
    () =>
      runCapturedPrivateCommand("wrangler", ["deploy"], {
        spawn: () => ({
          status: 1,
          stdout: "private-worker",
          stderr: "private-database-id",
        }),
      }),
    (error) =>
      error instanceof PrivateWranglerError &&
      error.code === "PRIVATE_COMMAND_FAILED" &&
      !String(error).includes("private-worker") &&
      !String(error).includes("private-database-id"),
  );
});

test("package scripts route remote Cloudflare work through the private wrapper", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));
  assert.equal(
    packageJson.scripts["db:migrate:ci"],
    "node scripts/run-private-wrangler.mjs migrate",
  );
  assert.match(
    packageJson.scripts["deploy:ci"],
    /node scripts\/run-private-wrangler\.mjs deploy/u,
  );
  assert.doesNotMatch(packageJson.scripts["deploy:ci"], /wrangler deploy/u);
});
