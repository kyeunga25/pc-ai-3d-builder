import { mkdir, readFile, writeFile } from "node:fs/promises";
import process from "node:process";

import { parse } from "jsonc-parser";

const requiredBuildValues = [
  "RIGSTAGE_D1_DATABASE_ID",
  "RIGSTAGE_D1_DATABASE_NAME",
  "RIGSTAGE_R2_BUCKET_NAME",
  "RIGSTAGE_WORKFLOW_NAME",
  "RIGSTAGE_RATE_NAMESPACE_ID",
];

function requireBuildValue(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required Cloudflare build value: ${name}`);
  }

  return value;
}

const values = Object.fromEntries(
  requiredBuildValues.map((name) => [name, requireBuildValue(name)]),
);

const workerName =
  process.env.WRANGLER_CI_OVERRIDE_NAME?.trim() ||
  requireBuildValue("RIGSTAGE_WORKER_NAME");

if (!/^\d+$/.test(values.RIGSTAGE_RATE_NAMESPACE_ID)) {
  throw new Error("RIGSTAGE_RATE_NAMESPACE_ID must contain digits only");
}

const source = parse(await readFile("wrangler.jsonc", "utf8"));

source.$schema = "../node_modules/wrangler/config-schema.json";
source.name = workerName;
source.main = "../src/worker/index.ts";
source.workers_dev = false;
source.preview_urls = false;
source.assets = { ...source.assets, directory: "../dist" };
source.workers_dev = false;
source.preview_urls = false;

source.d1_databases = [
  {
    ...source.d1_databases[0],
    migrations_dir: "../migrations",
    database_name: values.RIGSTAGE_D1_DATABASE_NAME,
    database_id: values.RIGSTAGE_D1_DATABASE_ID,
  },
];
source.r2_buckets = [
  {
    ...source.r2_buckets[0],
    bucket_name: values.RIGSTAGE_R2_BUCKET_NAME,
  },
];
source.ratelimits = [
  {
    ...source.ratelimits[0],
    namespace_id: values.RIGSTAGE_RATE_NAMESPACE_ID,
  },
];
source.workflows = [
  {
    ...source.workflows[0],
    name: values.RIGSTAGE_WORKFLOW_NAME,
  },
];

await mkdir(".wrangler", { recursive: true });
await writeFile(
  ".wrangler/deploy.jsonc",
  `${JSON.stringify(source, null, 2)}\n`,
  { mode: 0o600 },
);

process.stdout.write("Prepared private Cloudflare deployment configuration.\n");
