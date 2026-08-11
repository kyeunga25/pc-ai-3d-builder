import { spawnSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import process from "node:process";

import { parse } from "jsonc-parser";

const maxCommandOutputBytes = 8 * 1024 * 1024;
const privateBuildValueNames = [
  "RIGSTAGE_D1_DATABASE_ID",
  "RIGSTAGE_D1_DATABASE_NAME",
  "RIGSTAGE_R2_BUCKET_NAME",
  "RIGSTAGE_WORKFLOW_NAME",
  "RIGSTAGE_RATE_NAMESPACE_ID",
  "RIGSTAGE_WORKER_NAME",
  "WRANGLER_CI_OVERRIDE_NAME",
];

export class PrivateWranglerError extends Error {
  constructor(readonlyCode) {
    super(readonlyCode);
    this.name = "PrivateWranglerError";
    this.code = readonlyCode;
  }
}

export function privateWranglerEnvironment(source = process.env) {
  const environment = { ...source };
  for (const name of privateBuildValueNames) {
    delete environment[name];
  }
  environment.WRANGLER_SEND_METRICS = "false";
  environment.WRANGLER_LOG_PATH = ".wrangler/logs";
  return environment;
}

export function privateWranglerArguments(action, configPath) {
  if (action === "migrate") {
    return [
      "d1",
      "migrations",
      "apply",
      "DB",
      "--remote",
      "--config",
      configPath,
    ];
  }
  if (action === "deploy") {
    return ["deploy", "--config", configPath];
  }
  throw new PrivateWranglerError("PRIVATE_ACTION_INVALID");
}

export function runCapturedPrivateCommand(
  command,
  args,
  {
    cwd = process.cwd(),
    environment = privateWranglerEnvironment(),
    spawn = spawnSync,
  } = {},
) {
  let result;
  try {
    result = spawn(command, args, {
      cwd,
      encoding: "utf8",
      env: environment,
      maxBuffer: maxCommandOutputBytes,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    throw new PrivateWranglerError("PRIVATE_COMMAND_FAILED");
  }
  if (result?.status !== 0 || result.error) {
    throw new PrivateWranglerError("PRIVATE_COMMAND_FAILED");
  }
}

async function validatePrivateConfig(configPath) {
  const repositoryRoot = resolve(process.cwd());
  const absoluteConfigPath = resolve(configPath);
  const repositoryRelativePath = relative(repositoryRoot, absoluteConfigPath);
  if (
    !repositoryRelativePath ||
    repositoryRelativePath.startsWith("..") ||
    isAbsolute(repositoryRelativePath)
  ) {
    throw new PrivateWranglerError("PRIVATE_CONFIG_UNSAFE");
  }

  let fileStat;
  let config;
  try {
    fileStat = await stat(absoluteConfigPath);
    config = parse(await readFile(absoluteConfigPath, "utf8"));
  } catch {
    throw new PrivateWranglerError("PRIVATE_CONFIG_REQUIRED");
  }
  if (!fileStat.isFile() || (fileStat.mode & 0o077) !== 0) {
    throw new PrivateWranglerError("PRIVATE_CONFIG_UNSAFE");
  }

  const ignored = spawnSync(
    "git",
    ["check-ignore", "--quiet", "--", repositoryRelativePath],
    {
      cwd: repositoryRoot,
      env: privateWranglerEnvironment(),
      stdio: "ignore",
    },
  );
  const database = config?.d1_databases?.find(
    (binding) => binding?.binding === "DB",
  );
  const bucket = config?.r2_buckets?.find(
    (binding) => binding?.binding === "PRIVATE_ASSETS",
  );
  const workflow = config?.workflows?.find(
    (binding) => binding?.binding === "ASSET_GENERATION",
  );
  if (
    ignored.status !== 0 ||
    !database?.database_id ||
    !database?.database_name ||
    !bucket?.bucket_name ||
    !workflow?.name ||
    !config?.name ||
    config.workers_dev !== false ||
    config.preview_urls !== false
  ) {
    throw new PrivateWranglerError("PRIVATE_CONFIG_INCOMPLETE");
  }
  return absoluteConfigPath;
}

async function main() {
  const action = process.argv[2];
  const configPath = await validatePrivateConfig(
    process.env.RIGSTAGE_PRIVATE_DEPLOY_CONFIG?.trim() ||
      ".wrangler/deploy.jsonc",
  );
  const wranglerPath = resolve("node_modules/.bin/wrangler");
  try {
    await stat(wranglerPath);
  } catch {
    throw new PrivateWranglerError("WRANGLER_REQUIRED");
  }

  runCapturedPrivateCommand(
    wranglerPath,
    privateWranglerArguments(action, configPath),
  );
  process.stdout.write(
    action === "migrate"
      ? "Private Cloudflare migrations completed; deployment coordinates were not printed.\n"
      : "Private Cloudflare deployment completed; deployment coordinates were not printed.\n",
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    const code =
      error instanceof PrivateWranglerError ? error.code : "PRIVATE_UNKNOWN";
    process.stderr.write(
      `Private Cloudflare operation failed (${code}); deployment values were not printed.\n`,
    );
    process.exitCode = 1;
  });
}
