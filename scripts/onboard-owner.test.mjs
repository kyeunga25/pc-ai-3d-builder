import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  buildOwnerOnboardingSql,
  buildOwnerOnboardingVerificationSql,
  normalizeOwnerIdentity,
} from "./onboard-owner.mjs";

const syntheticInput = {
  identity: "owner@example.invalid",
  userId: "user_synthetic",
  workspaceId: "workspace_synthetic",
  workspaceSlug: "owner-beta-synthetic",
  auditId: "audit_synthetic",
  requestId: "onboarding_synthetic",
  includeCreditAccount: false,
  creditUnits: 0,
};

test("normalizes a private owner identity without deriving it", () => {
  assert.equal(
    normalizeOwnerIdentity("  OWNER@EXAMPLE.INVALID "),
    "owner@example.invalid",
  );
  assert.throws(() => normalizeOwnerIdentity(""));
  assert.throws(() => normalizeOwnerIdentity("not-an-email"));
});

test("builds idempotent active owner onboarding SQL", () => {
  const sql = buildOwnerOnboardingSql(syntheticInput);
  assert.match(sql, /ON CONFLICT\(email\) DO UPDATE/u);
  assert.match(sql, /role = 'owner'/u);
  assert.match(sql, /record_version = record_version \+ 1/u);
  assert.match(sql, /wm\.status = 'active'/u);
  assert.match(sql, /w\.status = 'active'/u);
  assert.match(sql, /AS onboarded/u);
  assert.doesNotMatch(sql, /generation_credit_accounts/u);
});

test("adds a bounded credit account only when the private schema supports it", () => {
  const sql = buildOwnerOnboardingSql({
    ...syntheticInput,
    includeCreditAccount: true,
    creditUnits: 2,
  });
  assert.match(sql, /generation_credit_accounts/u);
  assert.match(sql, /SELECT last_workspace_id, 2, 0, 0, 0/u);
  assert.match(sql, /ON CONFLICT\(workspace_id\) DO NOTHING/u);
});

test("verifies onboarding by private audit request without the identity", () => {
  const sql = buildOwnerOnboardingVerificationSql(
    "onboarding_synthetic_confirmation",
  );

  assert.match(sql, /event\.request_id = 'onboarding_synthetic_confirmation'/u);
  assert.match(sql, /event\.action = 'owner\.onboarded'/u);
  assert.match(sql, /wm\.role = 'owner'/u);
  assert.match(sql, /wm\.status = 'active'/u);
  assert.match(sql, /w\.status = 'active'/u);
  assert.doesNotMatch(sql, /owner@example\.invalid/u);
});

test("executes idempotently across the complete D1 schema", async () => {
  const database = new DatabaseSync(":memory:");

  try {
    const migrationsDirectory = join(process.cwd(), "migrations");
    const migrations = (await readdir(migrationsDirectory))
      .filter((name) => name.endsWith(".sql"))
      .sort();

    for (const migration of migrations) {
      database.exec(
        await readFile(join(migrationsDirectory, migration), "utf8"),
      );
    }

    database.exec(
      buildOwnerOnboardingSql({
        ...syntheticInput,
        includeCreditAccount: true,
        creditUnits: 2,
      }),
    );
    assert.throws(
      () =>
        database.exec("UPDATE workspace_memberships SET status = 'suspended'"),
      /WORKSPACE_LAST_OWNER/u,
    );
    database.exec(`
      INSERT INTO users (id, email, display_name, status)
      VALUES ('user_synthetic_backup', 'backup@example.invalid',
              'Synthetic Backup Owner', 'active');
      INSERT INTO workspace_memberships (workspace_id, user_id, role, status)
      VALUES ('workspace_synthetic', 'user_synthetic_backup',
              'owner', 'active');
      UPDATE workspace_memberships
      SET status = 'suspended'
      WHERE workspace_id = 'workspace_synthetic'
        AND user_id = 'user_synthetic';
    `);
    database.exec(`
      UPDATE users SET status = 'suspended'
      WHERE email = 'owner@example.invalid';
      UPDATE workspaces SET status = 'suspended';
    `);
    database.exec(
      buildOwnerOnboardingSql({
        ...syntheticInput,
        userId: "user_unused_second_run",
        workspaceId: "workspace_unused_second_run",
        workspaceSlug: "owner-beta-unused-second-run",
        auditId: "audit_second_run",
        requestId: "onboarding_second_run",
        includeCreditAccount: true,
        creditUnits: 999,
      }),
    );
    database.exec("DELETE FROM users WHERE id = 'user_synthetic_backup'");

    const result = database
      .prepare(
        `
        SELECT
          u.status AS user_status,
          wm.role,
          wm.status AS membership_status,
          wm.record_version AS membership_version,
          w.status AS workspace_status,
          (SELECT COUNT(*) FROM users) AS user_count,
          (SELECT COUNT(*) FROM workspaces) AS workspace_count,
          (SELECT COUNT(*) FROM workspace_memberships) AS membership_count,
          (SELECT COUNT(*) FROM audit_events) AS audit_count,
          (SELECT COUNT(*) FROM generation_credit_accounts) AS credit_account_count,
          (SELECT available_units FROM generation_credit_accounts) AS available_units
        FROM users AS u
        INNER JOIN workspace_memberships AS wm ON wm.user_id = u.id
        INNER JOIN workspaces AS w ON w.id = wm.workspace_id
        WHERE u.email = 'owner@example.invalid'
      `,
      )
      .get();

    assert.deepEqual(
      { ...result },
      {
        user_status: "active",
        role: "owner",
        membership_status: "active",
        membership_version: 1,
        workspace_status: "active",
        user_count: 1,
        workspace_count: 1,
        membership_count: 1,
        audit_count: 2,
        credit_account_count: 1,
        available_units: 2,
      },
    );
  } finally {
    database.close();
  }
});
