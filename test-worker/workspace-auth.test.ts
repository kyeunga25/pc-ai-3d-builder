import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import type { WorkspaceRole } from "../src/shared/domain/session";
import type { AccessIdentity } from "../src/worker/auth/access";
import {
  persistWorkspaceSelection,
  resolveRequestContext,
} from "../src/worker/auth/workspace";

type IdentityFixture = {
  email: string;
  subject: string;
  userId: string;
  workspaceId: string;
};

function fixture(label: string): IdentityFixture {
  return {
    email: `${label}@example.invalid`,
    subject: `access-${label}`,
    userId: `user-${label}`,
    workspaceId: `workspace-${label}`,
  };
}

function identity(value: IdentityFixture): AccessIdentity {
  return {
    subject: value.subject,
    email: value.email,
    displayName: "Workspace Auth Fixture",
  };
}

async function seedIdentity(
  value: IdentityFixture,
  userStatus: "active" | "invited" = "active",
  role: WorkspaceRole = "owner",
): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO workspaces (id, slug, name) VALUES (?1, ?2, ?3)",
    ).bind(value.workspaceId, value.workspaceId, "Workspace Auth Fixture"),
    env.DB.prepare(
      `INSERT INTO users (id, email, display_name, status)
       VALUES (?1, ?2, ?3, ?4)`,
    ).bind(value.userId, value.email, "Workspace Auth Fixture", userStatus),
    env.DB.prepare(
      `INSERT INTO workspace_memberships (workspace_id, user_id, role)
       VALUES (?1, ?2, ?3)`,
    ).bind(value.workspaceId, value.userId, role),
  ]);
}

function databaseWithBeforeUserUpdate(
  sqlFragment: string,
  beforeBinding: () => Promise<void>,
): D1Database {
  let pending = true;
  return {
    prepare(query: string) {
      const statement = env.DB.prepare(query);
      if (!query.includes(sqlFragment)) {
        return statement;
      }
      return {
        bind(...values: unknown[]) {
          const bound = statement.bind(...values);
          return {
            async run() {
              if (pending) {
                pending = false;
                await beforeBinding();
              }
              return bound.run();
            },
          } as D1PreparedStatement;
        },
      } as D1PreparedStatement;
    },
  } as D1Database;
}

describe("workspace identity runtime binding", () => {
  it("does not bind after membership revocation and recovers after reactivation", async () => {
    const target = fixture("membership-revocation");
    await seedIdentity(target, "invited", "staff");
    const racingDb = databaseWithBeforeUserUpdate(
      "SET access_subject =",
      async () => {
        await env.DB.prepare(
          `UPDATE workspace_memberships SET status = 'suspended'
           WHERE workspace_id = ?1 AND user_id = ?2`,
        )
          .bind(target.workspaceId, target.userId)
          .run();
      },
    );

    await expect(
      resolveRequestContext(racingDb, identity(target), target.workspaceId),
    ).rejects.toMatchObject({
      status: 403,
      code: "INVITE_REQUIRED",
      message: expect.stringMatching(/有效.*membership/iu),
    });
    expect(
      await env.DB.prepare(
        `SELECT status, access_subject, last_workspace_id, last_seen_at
         FROM users WHERE id = ?1`,
      )
        .bind(target.userId)
        .first(),
    ).toEqual({
      access_subject: null,
      last_workspace_id: null,
      last_seen_at: null,
      status: "invited",
    });

    await env.DB.prepare(
      `UPDATE workspace_memberships SET status = 'active'
       WHERE workspace_id = ?1 AND user_id = ?2`,
    )
      .bind(target.workspaceId, target.userId)
      .run();
    await expect(
      resolveRequestContext(env.DB, identity(target), target.workspaceId),
    ).resolves.toMatchObject({
      user: { id: target.userId },
      currentWorkspace: { id: target.workspaceId, role: "staff" },
    });
    expect(
      await env.DB.prepare(
        `SELECT status, access_subject, last_workspace_id,
                last_seen_at IS NOT NULL AS has_last_seen
         FROM users WHERE id = ?1`,
      )
        .bind(target.userId)
        .first(),
    ).toEqual({
      access_subject: target.subject,
      last_workspace_id: target.workspaceId,
      has_last_seen: 1,
      status: "active",
    });
  });

  it("keeps a concurrent different-subject winner and rejects the loser", async () => {
    const target = fixture("binding-loser");
    await seedIdentity(target);
    const racingDb = databaseWithBeforeUserUpdate(
      "SET access_subject =",
      async () => {
        await env.DB.prepare(
          `UPDATE users SET access_subject = 'access-binding-winner'
           WHERE id = ?1 AND access_subject IS NULL`,
        )
          .bind(target.userId)
          .run();
      },
    );

    await expect(
      resolveRequestContext(racingDb, identity(target), target.workspaceId),
    ).rejects.toMatchObject({
      status: 403,
      code: "IDENTITY_BINDING_CONFLICT",
    });
    expect(
      await env.DB.prepare("SELECT access_subject FROM users WHERE id = ?1")
        .bind(target.userId)
        .first(),
    ).toEqual({ access_subject: "access-binding-winner" });
  });

  it("accepts a concurrent repeat by the same subject while membership stays active", async () => {
    const target = fixture("binding-repeat");
    await seedIdentity(target);
    const racingDb = databaseWithBeforeUserUpdate(
      "SET access_subject =",
      async () => {
        await env.DB.prepare(
          `UPDATE users SET access_subject = ?1
           WHERE id = ?2 AND access_subject IS NULL`,
        )
          .bind(target.subject, target.userId)
          .run();
      },
    );

    await expect(
      resolveRequestContext(racingDb, identity(target), target.workspaceId),
    ).resolves.toMatchObject({
      user: { id: target.userId },
      currentWorkspace: { id: target.workspaceId },
    });
    expect(
      await env.DB.prepare("SELECT access_subject FROM users WHERE id = ?1")
        .bind(target.userId)
        .first(),
    ).toEqual({ access_subject: target.subject });
  });

  it("does not persist a workspace switch after target membership revocation", async () => {
    const target = fixture("workspace-switch");
    const nextWorkspaceId = "workspace-switch-next";
    await seedIdentity(target);
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO workspaces (id, slug, name) VALUES (?1, ?2, ?3)",
      ).bind(nextWorkspaceId, nextWorkspaceId, "Next Workspace Fixture"),
      env.DB.prepare(
        `INSERT INTO workspace_memberships (workspace_id, user_id, role)
         VALUES (?1, ?2, 'admin')`,
      ).bind(nextWorkspaceId, target.userId),
      env.DB.prepare(
        `UPDATE users SET access_subject = ?1, last_workspace_id = ?2
         WHERE id = ?3`,
      ).bind(target.subject, target.workspaceId, target.userId),
    ]);
    const racingDb = databaseWithBeforeUserUpdate(
      "SET last_workspace_id =",
      async () => {
        await env.DB.prepare(
          `UPDATE workspace_memberships SET status = 'suspended'
           WHERE workspace_id = ?1 AND user_id = ?2`,
        )
          .bind(nextWorkspaceId, target.userId)
          .run();
      },
    );

    const selectedContext = await resolveRequestContext(
      racingDb,
      identity(target),
      nextWorkspaceId,
    );
    expect(selectedContext.currentWorkspace).toMatchObject({
      id: nextWorkspaceId,
      role: "admin",
    });
    expect(
      await env.DB.prepare("SELECT last_workspace_id FROM users WHERE id = ?1")
        .bind(target.userId)
        .first(),
    ).toEqual({ last_workspace_id: target.workspaceId });

    await expect(
      persistWorkspaceSelection(racingDb, selectedContext, target.subject),
    ).rejects.toMatchObject({
      status: 403,
      code: "WORKSPACE_FORBIDDEN",
      message: expect.stringMatching(/工作空間.*workspace/iu),
    });
    expect(
      await env.DB.prepare("SELECT last_workspace_id FROM users WHERE id = ?1")
        .bind(target.userId)
        .first(),
    ).toEqual({ last_workspace_id: target.workspaceId });

    await env.DB.prepare(
      `UPDATE workspace_memberships SET status = 'active'
       WHERE workspace_id = ?1 AND user_id = ?2`,
    )
      .bind(nextWorkspaceId, target.userId)
      .run();
    const recoveredContext = await resolveRequestContext(
      env.DB,
      identity(target),
      nextWorkspaceId,
    );
    expect(recoveredContext).toMatchObject({
      currentWorkspace: { id: nextWorkspaceId, role: "admin" },
    });
    expect(
      await env.DB.prepare("SELECT last_workspace_id FROM users WHERE id = ?1")
        .bind(target.userId)
        .first(),
    ).toEqual({ last_workspace_id: target.workspaceId });
    await persistWorkspaceSelection(env.DB, recoveredContext, target.subject);
    expect(
      await env.DB.prepare("SELECT last_workspace_id FROM users WHERE id = ?1")
        .bind(target.userId)
        .first(),
    ).toEqual({ last_workspace_id: nextWorkspaceId });
  });
});
