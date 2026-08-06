import { randomUUID } from "node:crypto";
import {
  mkdtemp,
  readFile,
  rmdir,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

import { parse } from "jsonc-parser";

const maxPrivateValueLength = 254;
const maxCommandOutputBytes = 1024 * 1024;

class OnboardingError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

export function normalizeOwnerIdentity(value) {
  const identity = typeof value === "string" ? value.trim().toLowerCase() : "";
  const hasControlCharacters = [...identity].some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint <= 0x1f || codePoint === 0x7f);
  });

  if (!identity) {
    throw new OnboardingError("OWNER_IDENTITY_REQUIRED");
  }

  if (
    identity.length > maxPrivateValueLength ||
    hasControlCharacters ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(identity)
  ) {
    throw new OnboardingError("OWNER_IDENTITY_INVALID");
  }

  return identity;
}

function sqlString(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function stablePrivateId(prefix) {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`;
}

export function buildOwnerOnboardingSql({
  identity,
  userId,
  workspaceId,
  workspaceSlug,
  auditId,
  requestId,
  includeCreditAccount,
  creditUnits,
}) {
  const email = sqlString(normalizeOwnerIdentity(identity));
  const user = sqlString(userId);
  const workspace = sqlString(workspaceId);
  const slug = sqlString(workspaceSlug);
  const audit = sqlString(auditId);
  const request = sqlString(requestId);
  const creditStatement = includeCreditAccount
    ? `
INSERT INTO generation_credit_accounts (
  workspace_id, available_units, reserved_units, settled_units, released_units
)
SELECT last_workspace_id, ${creditUnits}, 0, 0, 0
FROM users
WHERE lower(email) = lower(${email})
  AND last_workspace_id IS NOT NULL
ON CONFLICT(workspace_id) DO NOTHING;
`
    : "";

  return `PRAGMA foreign_keys = ON;

INSERT INTO users (id, email, display_name, status)
VALUES (${user}, ${email}, 'Owner beta user', 'active')
ON CONFLICT(email) DO UPDATE SET
  status = 'active',
  updated_at = CURRENT_TIMESTAMP;

UPDATE workspaces
SET status = 'active', updated_at = CURRENT_TIMESTAMP
WHERE id = (
  SELECT wm.workspace_id
  FROM workspace_memberships AS wm
  INNER JOIN users AS u ON u.id = wm.user_id
  INNER JOIN workspaces AS w ON w.id = wm.workspace_id
  WHERE lower(u.email) = lower(${email})
    AND wm.role = 'owner'
    AND w.status IN ('active', 'suspended')
  ORDER BY CASE WHEN w.status = 'active' THEN 0 ELSE 1 END,
           wm.created_at,
           wm.workspace_id
  LIMIT 1
);

UPDATE workspace_memberships
SET role = 'owner', status = 'active', updated_at = CURRENT_TIMESTAMP
WHERE user_id = (SELECT id FROM users WHERE lower(email) = lower(${email}))
  AND workspace_id = (
    SELECT wm.workspace_id
    FROM workspace_memberships AS wm
    INNER JOIN users AS u ON u.id = wm.user_id
    INNER JOIN workspaces AS w ON w.id = wm.workspace_id
    WHERE lower(u.email) = lower(${email})
      AND wm.role = 'owner'
      AND w.status = 'active'
    ORDER BY wm.created_at, wm.workspace_id
    LIMIT 1
  );

INSERT INTO workspaces (id, slug, name, locale, currency, status)
SELECT ${workspace}, ${slug}, 'RigStage Owner Beta', 'zh-Hant-HK', 'HKD', 'active'
WHERE NOT EXISTS (
  SELECT 1
  FROM workspace_memberships AS wm
  INNER JOIN users AS u ON u.id = wm.user_id
  INNER JOIN workspaces AS w ON w.id = wm.workspace_id
  WHERE lower(u.email) = lower(${email})
    AND wm.role = 'owner'
    AND wm.status = 'active'
    AND w.status = 'active'
);

INSERT INTO workspace_memberships (workspace_id, user_id, role, status)
SELECT w.id, u.id, 'owner', 'active'
FROM workspaces AS w
CROSS JOIN users AS u
WHERE w.id = ${workspace}
  AND lower(u.email) = lower(${email})
  AND NOT EXISTS (
    SELECT 1
    FROM workspace_memberships AS existing
    INNER JOIN workspaces AS active_workspace
      ON active_workspace.id = existing.workspace_id
    WHERE existing.user_id = u.id
      AND existing.role = 'owner'
      AND existing.status = 'active'
      AND active_workspace.status = 'active'
  )
ON CONFLICT(workspace_id, user_id) DO UPDATE SET
  role = 'owner',
  status = 'active',
  updated_at = CURRENT_TIMESTAMP;

UPDATE users
SET last_workspace_id = (
      SELECT wm.workspace_id
      FROM workspace_memberships AS wm
      INNER JOIN workspaces AS w ON w.id = wm.workspace_id
      WHERE wm.user_id = users.id
        AND wm.role = 'owner'
        AND wm.status = 'active'
        AND w.status = 'active'
      ORDER BY wm.created_at, wm.workspace_id
      LIMIT 1
    ),
    last_seen_at = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE lower(email) = lower(${email});
${creditStatement}
INSERT INTO audit_events (
  id, workspace_id, user_id, action, target_type, target_id,
  request_id, metadata_json
)
SELECT ${audit}, u.last_workspace_id, u.id, 'owner.onboarded',
       'workspace', u.last_workspace_id, ${request},
       '{"role":"owner","source":"private_onboarding"}'
FROM users AS u
WHERE lower(u.email) = lower(${email})
  AND u.last_workspace_id IS NOT NULL;

SELECT CASE WHEN EXISTS (
  SELECT 1
  FROM users AS u
  INNER JOIN workspace_memberships AS wm ON wm.user_id = u.id
  INNER JOIN workspaces AS w ON w.id = wm.workspace_id
  WHERE lower(u.email) = lower(${email})
    AND u.status = 'active'
    AND wm.role = 'owner'
    AND wm.status = 'active'
    AND w.status = 'active'
) THEN 1 ELSE 0 END AS onboarded;
`;
}

export function buildOwnerOnboardingVerificationSql(requestId) {
  const request = sqlString(requestId);

  return `SELECT CASE WHEN EXISTS (
  SELECT 1
  FROM audit_events AS event
  INNER JOIN users AS u ON u.id = event.user_id
  INNER JOIN workspace_memberships AS wm
    ON wm.user_id = u.id AND wm.workspace_id = event.workspace_id
  INNER JOIN workspaces AS w ON w.id = event.workspace_id
  WHERE event.request_id = ${request}
    AND event.action = 'owner.onboarded'
    AND u.status = 'active'
    AND wm.role = 'owner'
    AND wm.status = 'active'
    AND w.status = 'active'
) THEN 1 ELSE 0 END AS onboarded`;
}

function privateChildEnvironment() {
  const environment = { ...process.env };
  delete environment.OWNER_LOGIN_IDENTITY;
  delete environment.OWNER_BETA_CREDIT_UNITS;
  return environment;
}

function runQuietly(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    env: privateChildEnvironment(),
    maxBuffer: maxCommandOutputBytes,
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0 || result.error) {
    throw new OnboardingError("PRIVATE_OPERATION_FAILED");
  }

  return result.stdout;
}

function findNumericResult(value, key) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findNumericResult(item, key);
      if (found !== null) return found;
    }
    return null;
  }

  if (value && typeof value === "object") {
    if (Object.hasOwn(value, key)) {
      const number = Number(value[key]);
      return Number.isFinite(number) ? number : null;
    }
    for (const item of Object.values(value)) {
      const found = findNumericResult(item, key);
      if (found !== null) return found;
    }
  }

  return null;
}

function parseQuietJson(output) {
  try {
    return JSON.parse(output);
  } catch {
    throw new OnboardingError("PRIVATE_OPERATION_UNCONFIRMED");
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
    throw new OnboardingError("PRIVATE_CONFIG_UNSAFE");
  }

  let fileStat;
  let config;
  try {
    fileStat = await stat(absoluteConfigPath);
    config = parse(await readFile(absoluteConfigPath, "utf8"));
  } catch {
    throw new OnboardingError("PRIVATE_CONFIG_REQUIRED");
  }

  if (!fileStat.isFile() || (fileStat.mode & 0o077) !== 0) {
    throw new OnboardingError("PRIVATE_CONFIG_UNSAFE");
  }

  const ignored = spawnSync(
    "git",
    ["check-ignore", "--quiet", "--", repositoryRelativePath],
    {
      cwd: repositoryRoot,
      env: privateChildEnvironment(),
      stdio: "ignore",
    },
  );

  if (ignored.status !== 0) {
    throw new OnboardingError("PRIVATE_CONFIG_UNSAFE");
  }

  const database = config?.d1_databases?.find(
    (binding) => binding?.binding === "DB",
  );
  if (
    !database?.database_id ||
    config?.workers_dev !== false ||
    config?.preview_urls !== false
  ) {
    throw new OnboardingError("PRIVATE_CONFIG_INCOMPLETE");
  }

  return absoluteConfigPath;
}

function creditUnitsFromEnvironment() {
  const raw = process.env.OWNER_BETA_CREDIT_UNITS?.trim() || "0";
  if (!/^\d{1,4}$/u.test(raw)) {
    throw new OnboardingError("OWNER_CREDIT_UNITS_INVALID");
  }
  const units = Number(raw);
  if (!Number.isSafeInteger(units) || units < 0 || units > 1000) {
    throw new OnboardingError("OWNER_CREDIT_UNITS_INVALID");
  }
  return units;
}

async function main() {
  if (process.argv.includes("--help")) {
    process.stdout.write(
      "Reads OWNER_LOGIN_IDENTITY from the private environment and provisions one active owner workspace without printing identity or deployment values.\n",
    );
    return;
  }

  const identity = normalizeOwnerIdentity(process.env.OWNER_LOGIN_IDENTITY);
  const creditUnits = creditUnitsFromEnvironment();
  const configPath = await validatePrivateConfig(
    process.env.RIGSTAGE_PRIVATE_DEPLOY_CONFIG?.trim() ||
      ".wrangler/deploy.jsonc",
  );
  const wranglerPath = resolve("node_modules/.bin/wrangler");

  try {
    await stat(wranglerPath);
  } catch {
    throw new OnboardingError("WRANGLER_REQUIRED");
  }

  const baseArguments = [
    "d1",
    "execute",
    "DB",
    "--remote",
    "--config",
    configPath,
    "--yes",
    "--json",
  ];
  const schemaOutput = runQuietly(wranglerPath, [
    ...baseArguments,
    "--command",
    "SELECT CASE WHEN EXISTS (SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'generation_credit_accounts') THEN 1 ELSE 0 END AS present",
  ]);
  const hasCreditTable =
    findNumericResult(parseQuietJson(schemaOutput), "present") === 1;

  if (creditUnits > 0 && !hasCreditTable) {
    throw new OnboardingError("OWNER_CREDIT_SCHEMA_REQUIRED");
  }

  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), "rigstage-private-owner-"),
  );
  const sqlPath = join(temporaryDirectory, "onboarding.sql");

  try {
    const requestId = stablePrivateId("onboarding");
    const sql = buildOwnerOnboardingSql({
      identity,
      userId: stablePrivateId("user"),
      workspaceId: stablePrivateId("workspace"),
      workspaceSlug: `owner-beta-${randomUUID().slice(0, 12)}`,
      auditId: stablePrivateId("audit"),
      requestId,
      includeCreditAccount: hasCreditTable,
      creditUnits,
    });
    await writeFile(sqlPath, sql, { mode: 0o600, flag: "wx" });
    runQuietly(wranglerPath, [...baseArguments, "--file", sqlPath]);
    const verificationOutput = runQuietly(wranglerPath, [
      ...baseArguments,
      "--command",
      buildOwnerOnboardingVerificationSql(requestId),
    ]);
    const onboarded = findNumericResult(
      parseQuietJson(verificationOutput),
      "onboarded",
    );
    if (onboarded !== 1) {
      throw new OnboardingError("PRIVATE_OPERATION_UNCONFIRMED");
    }
  } finally {
    await unlink(sqlPath).catch(() => {});
    await rmdir(temporaryDirectory).catch(() => {});
  }

  process.stdout.write(
    "Private owner onboarding completed; identity and deployment values were not printed.\n",
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    const code = error instanceof OnboardingError ? error.code : "UNKNOWN";
    process.stderr.write(
      `Private owner onboarding failed (${code}); identity and deployment values were not printed.\n`,
    );
    process.exitCode = 1;
  });
}
