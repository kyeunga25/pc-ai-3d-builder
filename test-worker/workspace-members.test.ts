import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import type { WorkspaceRole } from "../src/shared/domain/session";
import { workspaceMemberListResponseSchema } from "../src/shared/domain/workspace-members";
import type { RequestContext } from "../src/worker/auth/workspace";
import { resolveRequestContext } from "../src/worker/auth/workspace";
import {
  workspaceMemberInviteResponse,
  workspaceMemberListResponse,
  workspaceMemberUpdateResponse,
} from "../src/worker/routes/workspace-members";

type ActorFixture = {
  email: string;
  role: WorkspaceRole;
  slug: string;
  userId: string;
  workspaceId: string;
};

function actor(label: string, role: WorkspaceRole = "owner"): ActorFixture {
  return {
    email: `${label}@example.invalid`,
    role,
    slug: label,
    userId: `user-${label}`,
    workspaceId: `workspace-${label}`,
  };
}

function context(value: ActorFixture): RequestContext {
  return {
    user: {
      id: value.userId,
      email: value.email,
      displayName: "Synthetic Manager",
    },
    currentWorkspace: {
      id: value.workspaceId,
      slug: value.slug,
      name: "Synthetic Workspace",
      locale: "zh-Hant-HK",
      currency: "HKD",
      role: value.role,
    },
    workspaces: [],
  };
}

async function seedActor(value: ActorFixture): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO workspaces (id, slug, name) VALUES (?1, ?2, ?3)",
    ).bind(value.workspaceId, value.slug, "Synthetic Workspace"),
    env.DB.prepare(
      `INSERT INTO users (
         id, email, access_subject, display_name, status, last_workspace_id
       ) VALUES (?1, ?2, ?3, ?4, 'active', ?5)`,
    ).bind(
      value.userId,
      value.email,
      `access-${value.slug}`,
      "Synthetic Manager",
      value.workspaceId,
    ),
    env.DB.prepare(
      `INSERT INTO workspace_memberships (workspace_id, user_id, role)
       VALUES (?1, ?2, ?3)`,
    ).bind(value.workspaceId, value.userId, value.role),
  ]);
}

async function seedMember(
  manager: ActorFixture,
  label: string,
  role: WorkspaceRole = "staff",
): Promise<string> {
  const userId = `user-${label}`;
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO users (id, email, display_name, status)
       VALUES (?1, ?2, ?3, 'active')`,
    ).bind(userId, `${label}@example.invalid`, "Synthetic Member"),
    env.DB.prepare(
      `INSERT INTO workspace_memberships (workspace_id, user_id, role)
       VALUES (?1, ?2, ?3)`,
    ).bind(manager.workspaceId, userId, role),
  ]);
  return userId;
}

function inviteRequest(email: string, role: WorkspaceRole = "staff"): Request {
  return new Request("https://local.invalid/api/workspace/members", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      displayName: "Synthetic Invitee",
      email,
      role,
    }),
  });
}

function updateRequest(
  userId: string,
  expectedVersion: number,
  role: WorkspaceRole,
  status: "active" | "suspended",
): Request {
  return new Request("https://local.invalid/api/workspace/member", {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "x-rigstage-workspace-member-id": userId,
    },
    body: JSON.stringify({ expectedVersion, role, status }),
  });
}

describe("workspace member management", () => {
  it("invites an unbound member and activates only after verified first login", async () => {
    const owner = actor("member-invite-owner");
    await seedActor(owner);
    const invitedEmail = "member-invite-pilot@example.invalid";

    const response = await workspaceMemberInviteResponse(
      inviteRequest(invitedEmail),
      env.DB,
      context(owner),
      "request-member-invite",
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      email: invitedEmail,
      identityState: "pending",
      role: "staff",
      status: "active",
      version: 0,
    });
    expect(
      await env.DB.prepare(
        `SELECT u.status AS user_status, u.access_subject,
                wm.status AS membership_status, wm.record_version
         FROM users AS u
         INNER JOIN workspace_memberships AS wm ON wm.user_id = u.id
         WHERE wm.workspace_id = ?1 AND lower(u.email) = ?2`,
      )
        .bind(owner.workspaceId, invitedEmail)
        .first(),
    ).toEqual({
      access_subject: null,
      membership_status: "active",
      record_version: 0,
      user_status: "invited",
    });
    expect(
      await env.DB.prepare(
        `SELECT COUNT(*) AS count
         FROM audit_events
         WHERE workspace_id = ?1 AND action = 'workspace.member.invite'`,
      )
        .bind(owner.workspaceId)
        .first(),
    ).toEqual({ count: 1 });

    const session = await resolveRequestContext(
      env.DB,
      {
        subject: "access-member-invite-pilot",
        email: invitedEmail,
        displayName: "Verified Pilot",
      },
      owner.workspaceId,
    );
    expect(session.currentWorkspace.id).toBe(owner.workspaceId);
    expect(
      await env.DB.prepare(
        "SELECT status, access_subject FROM users WHERE lower(email) = ?1",
      )
        .bind(invitedEmail)
        .first(),
    ).toEqual({
      access_subject: "access-member-invite-pilot",
      status: "active",
    });
  });

  it("reuses an existing bound identity for another workspace without rewriting it", async () => {
    const existingOwner = actor("member-existing-identity");
    const invitingOwner = actor("member-existing-inviter");
    await seedActor(existingOwner);
    await seedActor(invitingOwner);

    const response = await workspaceMemberInviteResponse(
      inviteRequest(existingOwner.email, "viewer"),
      env.DB,
      context(invitingOwner),
      "request-member-existing-identity",
    );

    await expect(response.json()).resolves.toMatchObject({
      id: existingOwner.userId,
      identityState: "bound",
      role: "viewer",
      version: 0,
    });
    expect(
      await env.DB.prepare(
        `SELECT COUNT(*) AS count
         FROM users
         WHERE lower(email) = ?1`,
      )
        .bind(existingOwner.email)
        .first(),
    ).toEqual({ count: 1 });

    await expect(
      resolveRequestContext(
        env.DB,
        {
          subject: `access-${existingOwner.slug}`,
          email: existingOwner.email,
          displayName: "Verified Existing User",
        },
        invitingOwner.workspaceId,
      ),
    ).resolves.toMatchObject({
      currentWorkspace: {
        id: invitingOwner.workspaceId,
        role: "viewer",
      },
      user: { id: existingOwner.userId },
    });
  });

  it("keeps member listing and mutation scoped to the verified workspace", async () => {
    const owner = actor("member-scope-owner");
    const foreignOwner = actor("member-scope-foreign");
    await seedActor(owner);
    await seedActor(foreignOwner);
    const memberId = await seedMember(owner, "member-scope-target");

    const ownResponse = workspaceMemberListResponse(env.DB, context(owner));
    const foreignResponse = workspaceMemberListResponse(
      env.DB,
      context(foreignOwner),
    );
    await expect((await ownResponse).json()).resolves.toMatchObject({
      items: expect.arrayContaining([
        expect.objectContaining({ id: memberId }),
      ]),
    });
    await expect((await foreignResponse).json()).resolves.toMatchObject({
      items: expect.not.arrayContaining([
        expect.objectContaining({ id: memberId }),
      ]),
    });

    await expect(
      workspaceMemberUpdateResponse(
        updateRequest(memberId, 0, "viewer", "active"),
        env.DB,
        context(foreignOwner),
        "request-member-cross-workspace",
      ),
    ).rejects.toMatchObject({
      code: "WORKSPACE_MEMBER_NOT_FOUND",
      status: 404,
    });
  });

  it("bounds the protected directory to 100 members and reports more rows", async () => {
    const owner = actor("member-limit-owner");
    await seedActor(owner);
    await env.DB.batch([
      env.DB.prepare(
        `WITH RECURSIVE sequence(value) AS (
           SELECT 0
           UNION ALL
           SELECT value + 1 FROM sequence WHERE value < 99
         )
         INSERT INTO users (id, email, display_name, status)
         SELECT 'user-member-limit-' || printf('%03d', value),
                'member-limit-' || printf('%03d', value) || '@example.invalid',
                'Synthetic Bounded Member', 'active'
         FROM sequence`,
      ),
      env.DB.prepare(
        `WITH RECURSIVE sequence(value) AS (
           SELECT 0
           UNION ALL
           SELECT value + 1 FROM sequence WHERE value < 99
         )
         INSERT INTO workspace_memberships (workspace_id, user_id, role)
         SELECT ?1, 'user-member-limit-' || printf('%03d', value), 'viewer'
         FROM sequence`,
      ).bind(owner.workspaceId),
    ]);

    const response = await workspaceMemberListResponse(env.DB, context(owner));
    const body = workspaceMemberListResponseSchema.parse(await response.json());

    expect(body).toMatchObject({ hasMore: true });
    expect(body.items).toHaveLength(100);
  });

  it("updates a member once and rejects a stale replay without a second audit", async () => {
    const owner = actor("member-version-owner");
    await seedActor(owner);
    const memberId = await seedMember(owner, "member-version-target");

    const response = await workspaceMemberUpdateResponse(
      updateRequest(memberId, 0, "viewer", "suspended"),
      env.DB,
      context(owner),
      "request-member-update",
    );
    await expect(response.json()).resolves.toMatchObject({
      id: memberId,
      role: "viewer",
      status: "suspended",
      version: 1,
    });

    await expect(
      workspaceMemberUpdateResponse(
        updateRequest(memberId, 0, "staff", "active"),
        env.DB,
        context(owner),
        "request-member-stale-replay",
      ),
    ).rejects.toMatchObject({
      code: "WORKSPACE_MEMBER_VERSION_CONFLICT",
      status: 409,
    });
    expect(
      await env.DB.prepare(
        `SELECT COUNT(*) AS count
         FROM audit_events
         WHERE workspace_id = ?1 AND action = 'workspace.member.update'`,
      )
        .bind(owner.workspaceId)
        .first(),
    ).toEqual({ count: 1 });
  });

  it("prevents self-management, administrator escalation and last-owner removal", async () => {
    const owner = actor("member-policy-owner");
    await seedActor(owner);
    const adminId = await seedMember(owner, "member-policy-admin", "admin");
    const admin = {
      ...owner,
      email: "member-policy-admin@example.invalid",
      role: "admin" as const,
      userId: adminId,
    };

    await expect(
      workspaceMemberUpdateResponse(
        updateRequest(owner.userId, 0, "owner", "suspended"),
        env.DB,
        context(owner),
        "request-member-self",
      ),
    ).rejects.toMatchObject({
      code: "WORKSPACE_MEMBER_SELF_FORBIDDEN",
      status: 409,
    });
    await expect(
      workspaceMemberUpdateResponse(
        updateRequest(owner.userId, 0, "staff", "active"),
        env.DB,
        context(admin),
        "request-member-admin-owner",
      ),
    ).rejects.toMatchObject({ code: "ROLE_FORBIDDEN", status: 403 });
    await expect(
      env.DB.prepare(
        `UPDATE workspace_memberships
         SET status = 'suspended'
         WHERE workspace_id = ?1 AND user_id = ?2`,
      )
        .bind(owner.workspaceId, owner.userId)
        .run(),
    ).rejects.toThrow(/WORKSPACE_LAST_OWNER/u);
    await expect(
      env.DB.prepare(
        `DELETE FROM workspace_memberships
         WHERE workspace_id = ?1 AND user_id = ?2`,
      )
        .bind(owner.workspaceId, owner.userId)
        .run(),
    ).rejects.toThrow(/WORKSPACE_LAST_OWNER/u);
  });

  it("rejects malformed, duplicate and over-privileged invitations", async () => {
    const owner = actor("member-invalid-owner");
    await seedActor(owner);
    const invitedEmail = "member-invalid-target@example.invalid";

    await expect(
      workspaceMemberInviteResponse(
        inviteRequest("not-an-email"),
        env.DB,
        context(owner),
        "request-member-invalid",
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });

    await workspaceMemberInviteResponse(
      inviteRequest(invitedEmail),
      env.DB,
      context(owner),
      "request-member-first",
    );
    await expect(
      workspaceMemberInviteResponse(
        inviteRequest(invitedEmail),
        env.DB,
        context(owner),
        "request-member-duplicate",
      ),
    ).rejects.toMatchObject({
      code: "WORKSPACE_MEMBER_CONFLICT",
      status: 409,
    });

    const adminId = await seedMember(owner, "member-invalid-admin", "admin");
    const admin = {
      ...owner,
      email: "member-invalid-admin@example.invalid",
      role: "admin" as const,
      userId: adminId,
    };
    await expect(
      workspaceMemberInviteResponse(
        inviteRequest("member-owner-escalation@example.invalid", "owner"),
        env.DB,
        context(admin),
        "request-member-escalation",
      ),
    ).rejects.toMatchObject({ code: "ROLE_FORBIDDEN", status: 403 });
  });

  it("rejects member directory access for a non-manager role", async () => {
    const owner = actor("member-role-owner");
    await seedActor(owner);
    const staffId = await seedMember(owner, "member-role-staff", "staff");
    const staff = {
      ...owner,
      email: "member-role-staff@example.invalid",
      role: "staff" as const,
      userId: staffId,
    };

    await expect(
      workspaceMemberListResponse(env.DB, context(staff)),
    ).rejects.toMatchObject({ code: "ROLE_FORBIDDEN", status: 403 });
    await expect(
      workspaceMemberInviteResponse(
        inviteRequest("member-role-denied@example.invalid"),
        env.DB,
        context(staff),
        "request-member-role-denied",
      ),
    ).rejects.toMatchObject({ code: "ROLE_FORBIDDEN", status: 403 });
  });
});
