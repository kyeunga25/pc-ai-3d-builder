import type { WorkspaceRole } from "../../shared/domain/session";
import {
  canAssignWorkspaceMemberRole,
  workspaceMemberInviteSchema,
  workspaceMemberListResponseSchema,
  workspaceMemberSchema,
  workspaceMemberUpdateSchema,
  type WorkspaceMember,
  type WorkspaceMemberIdentityState,
} from "../../shared/domain/workspace-members";
import {
  workspaceMemberIdPattern,
  workspaceMemberTargetHeader,
} from "../../shared/lib/workspace-member-target";
import type { RequestContext } from "../auth/workspace";
import { ApiError } from "../lib/api-error";
import { readBoundedJson } from "../lib/request-body";

type WorkspaceMemberRow = {
  access_subject: string | null;
  created_at: string;
  display_name: string | null;
  email: string;
  id: string;
  record_version: number;
  role: WorkspaceRole;
  status: "active" | "suspended";
  user_status: "invited" | "active" | "suspended";
};

const memberSelect = `
  SELECT u.id, u.email, u.display_name, u.access_subject,
         u.status AS user_status, wm.role, wm.status,
         wm.record_version, wm.created_at
  FROM workspace_memberships AS wm
  INNER JOIN users AS u ON u.id = wm.user_id`;

function roleForbidden(): ApiError {
  return new ApiError(
    403,
    "ROLE_FORBIDDEN",
    "你目前的工作空間角色無權管理成員。 / Your current workspace role cannot manage members.",
  );
}

function memberNotFound(): ApiError {
  return new ApiError(
    404,
    "WORKSPACE_MEMBER_NOT_FOUND",
    "找不到所要求的工作空間成員。 / The requested workspace member was not found.",
  );
}

function memberConflict(): ApiError {
  return new ApiError(
    409,
    "WORKSPACE_MEMBER_CONFLICT",
    "此邀請已存在或帳戶暫時不可加入，請重新載入成員名單。 / This invitation already exists or the account cannot be added. Reload the member list.",
  );
}

function versionConflict(): ApiError {
  return new ApiError(
    409,
    "WORKSPACE_MEMBER_VERSION_CONFLICT",
    "成員資格已由另一個操作更新，請重新載入後再試。 / The membership changed in another operation. Reload and try again.",
  );
}

function selfManagementForbidden(): ApiError {
  return new ApiError(
    409,
    "WORKSPACE_MEMBER_SELF_FORBIDDEN",
    "不可在此頁更改自己的角色或停用自己的成員資格。 / You cannot change your own role or suspend your own membership here.",
  );
}

function lastOwner(): ApiError {
  return new ApiError(
    409,
    "WORKSPACE_LAST_OWNER",
    "工作空間必須保留至少一位有效擁有人。 / The workspace must retain at least one active owner.",
  );
}

function validationError(): ApiError {
  return new ApiError(
    400,
    "VALIDATION_ERROR",
    "成員資料無效。 / The member data is invalid.",
  );
}

function assertManager(role: WorkspaceRole): void {
  if (role !== "owner" && role !== "admin") {
    throw roleForbidden();
  }
}

function assertAssignableRole(
  actorRole: WorkspaceRole,
  role: WorkspaceRole,
): void {
  if (!canAssignWorkspaceMemberRole(actorRole, role)) {
    throw roleForbidden();
  }
}

function identityState(row: WorkspaceMemberRow): WorkspaceMemberIdentityState {
  if (row.user_status === "suspended") {
    return "blocked";
  }
  return row.access_subject ? "bound" : "pending";
}

function mapMember(
  row: WorkspaceMemberRow,
  currentUserId: string,
): WorkspaceMember {
  return workspaceMemberSchema.parse({
    id: row.id,
    email: row.email,
    displayName: row.display_name?.trim() || row.email,
    role: row.role,
    status: row.status,
    identityState: identityState(row),
    isCurrentUser: row.id === currentUserId,
    version: Number(row.record_version),
    createdAt: row.created_at,
  });
}

async function findMember(
  db: D1Database,
  workspaceId: string,
  userId: string,
): Promise<WorkspaceMemberRow | null> {
  return db
    .prepare(
      `${memberSelect}
       WHERE wm.workspace_id = ?1 AND wm.user_id = ?2
       LIMIT 1`,
    )
    .bind(workspaceId, userId)
    .first<WorkspaceMemberRow>();
}

async function findMemberByEmail(
  db: D1Database,
  workspaceId: string,
  email: string,
): Promise<WorkspaceMemberRow | null> {
  return db
    .prepare(
      `${memberSelect}
       WHERE wm.workspace_id = ?1 AND lower(u.email) = ?2
       LIMIT 1`,
    )
    .bind(workspaceId, email)
    .first<WorkspaceMemberRow>();
}

export async function workspaceMemberListResponse(
  db: D1Database,
  context: RequestContext,
): Promise<Response> {
  assertManager(context.currentWorkspace.role);
  const result = await db
    .prepare(
      `${memberSelect}
       WHERE wm.workspace_id = ?1
       ORDER BY CASE wm.status WHEN 'active' THEN 0 ELSE 1 END,
                lower(u.email), u.id
       LIMIT 101`,
    )
    .bind(context.currentWorkspace.id)
    .all<WorkspaceMemberRow>();
  const items = result.results
    .slice(0, 100)
    .map((row) => mapMember(row, context.user.id));

  return Response.json(
    workspaceMemberListResponseSchema.parse({
      items,
      hasMore: result.results.length > 100,
    }),
    { headers: { "cache-control": "no-store" } },
  );
}

export async function workspaceMemberInviteResponse(
  request: Request,
  db: D1Database,
  context: RequestContext,
  requestId: string,
): Promise<Response> {
  assertManager(context.currentWorkspace.role);
  const parsed = workspaceMemberInviteSchema.safeParse(
    await readBoundedJson(request),
  );
  if (!parsed.success) {
    throw validationError();
  }
  const input = parsed.data;
  assertAssignableRole(context.currentWorkspace.role, input.role);

  const userId = `user_${crypto.randomUUID()}`;
  const results = await db.batch([
    db
      .prepare(
        `INSERT OR IGNORE INTO users (
           id, email, display_name, status
         ) VALUES (?1, ?2, ?3, 'invited')`,
      )
      .bind(userId, input.email, input.displayName),
    db
      .prepare(
        `INSERT OR IGNORE INTO workspace_memberships (
           workspace_id, user_id, role, status
         )
         SELECT ?1, id, ?2, 'active'
         FROM users
         WHERE lower(email) = ?3
           AND status IN ('invited', 'active')`,
      )
      .bind(context.currentWorkspace.id, input.role, input.email),
    db
      .prepare(
        `INSERT INTO audit_events (
           id, workspace_id, user_id, action, target_type, target_id,
           request_id, metadata_json
         )
         SELECT ?1, ?2, ?3, 'workspace.member.invite',
                'workspace_member', u.id, ?4, ?5
         FROM users AS u
         INNER JOIN workspace_memberships AS wm
           ON wm.user_id = u.id AND wm.workspace_id = ?2
         WHERE lower(u.email) = ?6 AND changes() = 1`,
      )
      .bind(
        crypto.randomUUID(),
        context.currentWorkspace.id,
        context.user.id,
        requestId,
        JSON.stringify({
          recordVersion: 0,
          role: input.role,
          status: "active",
        }),
        input.email,
      ),
  ]);

  if (results[1]?.meta.changes !== 1) {
    throw memberConflict();
  }
  const created = await findMemberByEmail(
    db,
    context.currentWorkspace.id,
    input.email,
  );
  if (!created) {
    throw new Error("Invited workspace member could not be read.");
  }

  return Response.json(mapMember(created, context.user.id), {
    status: 201,
    headers: { "cache-control": "no-store" },
  });
}

function assertTargetPolicy(
  actorRole: WorkspaceRole,
  target: WorkspaceMemberRow,
  nextRole: WorkspaceRole,
): void {
  assertAssignableRole(actorRole, nextRole);
  if (!canAssignWorkspaceMemberRole(actorRole, target.role)) {
    throw roleForbidden();
  }
}

async function assertOwnerContinuity(
  db: D1Database,
  workspaceId: string,
  target: WorkspaceMemberRow,
  nextRole: WorkspaceRole,
  nextStatus: "active" | "suspended",
): Promise<void> {
  if (
    target.role !== "owner" ||
    target.status !== "active" ||
    (nextRole === "owner" && nextStatus === "active")
  ) {
    return;
  }
  const otherOwner = await db
    .prepare(
      `SELECT 1 AS available
       FROM workspace_memberships
       WHERE workspace_id = ?1
         AND user_id <> ?2
         AND role = 'owner'
         AND status = 'active'
       LIMIT 1`,
    )
    .bind(workspaceId, target.id)
    .first<{ available: number }>();
  if (!otherOwner) {
    throw lastOwner();
  }
}

export async function workspaceMemberUpdateResponse(
  request: Request,
  db: D1Database,
  context: RequestContext,
  requestId: string,
): Promise<Response> {
  assertManager(context.currentWorkspace.role);
  const targetId = request.headers.get(workspaceMemberTargetHeader);
  if (!targetId || !workspaceMemberIdPattern.test(targetId)) {
    throw memberNotFound();
  }
  const target = await findMember(db, context.currentWorkspace.id, targetId);
  if (!target) {
    throw memberNotFound();
  }
  if (target.id === context.user.id) {
    throw selfManagementForbidden();
  }

  const parsed = workspaceMemberUpdateSchema.safeParse(
    await readBoundedJson(request),
  );
  if (!parsed.success) {
    throw validationError();
  }
  const input = parsed.data;
  assertTargetPolicy(context.currentWorkspace.role, target, input.role);
  await assertOwnerContinuity(
    db,
    context.currentWorkspace.id,
    target,
    input.role,
    input.status,
  );

  const nextVersion = input.expectedVersion + 1;
  let results: D1Result[];
  try {
    results = await db.batch([
      db
        .prepare(
          `UPDATE workspace_memberships
           SET role = ?1, status = ?2,
               record_version = record_version + 1,
               updated_at = CURRENT_TIMESTAMP
           WHERE workspace_id = ?3
             AND user_id = ?4
             AND record_version = ?5`,
        )
        .bind(
          input.role,
          input.status,
          context.currentWorkspace.id,
          target.id,
          input.expectedVersion,
        ),
      db
        .prepare(
          `INSERT INTO audit_events (
             id, workspace_id, user_id, action, target_type, target_id,
             request_id, metadata_json
           )
           SELECT ?1, workspace_id, ?2, 'workspace.member.update',
                  'workspace_member', user_id, ?3, ?4
           FROM workspace_memberships
           WHERE workspace_id = ?5
             AND user_id = ?6
             AND record_version = ?7
             AND changes() = 1`,
        )
        .bind(
          crypto.randomUUID(),
          context.user.id,
          requestId,
          JSON.stringify({
            recordVersion: nextVersion,
            role: input.role,
            status: input.status,
          }),
          context.currentWorkspace.id,
          target.id,
          nextVersion,
        ),
    ]);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("WORKSPACE_LAST_OWNER")
    ) {
      throw lastOwner();
    }
    throw error;
  }

  if (results[0]?.meta.changes !== 1) {
    throw versionConflict();
  }
  const updated = await findMember(db, context.currentWorkspace.id, target.id);
  if (!updated) {
    throw memberNotFound();
  }

  return Response.json(mapMember(updated, context.user.id), {
    headers: { "cache-control": "no-store" },
  });
}
