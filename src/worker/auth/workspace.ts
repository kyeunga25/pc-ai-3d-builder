import type {
  WorkspaceRole,
  WorkspaceSummary,
} from "../../shared/domain/session";
import type { AccessIdentity } from "./access";
import { ApiError } from "../lib/api-error";

type UserRow = {
  id: string;
  email: string;
  access_subject: string | null;
  display_name: string | null;
  last_workspace_id: string | null;
};

type ActiveBoundSubjectRow = {
  access_subject: string | null;
  has_active_membership: number;
};

export type WorkspaceMembershipRow = {
  id: string;
  slug: string;
  name: string;
  locale: string;
  currency: string;
  role: WorkspaceRole;
};

export type RequestContext = {
  user: {
    id: string;
    email: string;
    displayName: string;
  };
  currentWorkspace: WorkspaceSummary;
  workspaces: WorkspaceSummary[];
};

const workspaceIdPattern = /^[A-Za-z0-9_-]{1,128}$/u;

function inviteRequired(): ApiError {
  return new ApiError(
    403,
    "INVITE_REQUIRED",
    "此帳戶沒有有效的 RigStage 工作空間成員資格。 / This account has no active RigStage workspace membership.",
  );
}

function workspaceForbidden(): ApiError {
  return new ApiError(
    403,
    "WORKSPACE_FORBIDDEN",
    "你無權存取所要求的工作空間。 / You cannot access the requested workspace.",
  );
}

function identityBindingConflict(): ApiError {
  return new ApiError(
    403,
    "IDENTITY_BINDING_CONFLICT",
    "此邀請已連結至另一個身份，請聯絡工作空間管理員。 / This invitation is already linked to another identity. Contact a workspace administrator.",
  );
}

export function chooseCurrentWorkspace(
  memberships: WorkspaceMembershipRow[],
  requestedWorkspaceId: string | null,
  lastWorkspaceId: string | null,
): WorkspaceMembershipRow {
  if (memberships.length === 0) {
    throw inviteRequired();
  }

  if (requestedWorkspaceId) {
    if (!workspaceIdPattern.test(requestedWorkspaceId)) {
      throw workspaceForbidden();
    }

    const requested = memberships.find(
      (membership) => membership.id === requestedWorkspaceId,
    );

    if (!requested) {
      throw workspaceForbidden();
    }

    return requested;
  }

  return (
    memberships.find((membership) => membership.id === lastWorkspaceId) ??
    memberships[0]!
  );
}

export async function resolveRequestContext(
  db: D1Database,
  identity: AccessIdentity,
  requestedWorkspaceId: string | null,
): Promise<RequestContext> {
  const user = await db
    .prepare(
      `SELECT id, email, access_subject, display_name, last_workspace_id
       FROM users
       WHERE status = 'active'
         AND (
           access_subject = ?
           OR (access_subject IS NULL AND lower(email) = ?)
         )
       ORDER BY CASE WHEN access_subject = ? THEN 0 ELSE 1 END
       LIMIT 1`,
    )
    .bind(identity.subject, identity.email, identity.subject)
    .first<UserRow>();

  if (!user) {
    throw inviteRequired();
  }

  const membershipResult = await db
    .prepare(
      `SELECT w.id, w.slug, w.name, w.locale, w.currency, wm.role
       FROM workspace_memberships AS wm
       INNER JOIN workspaces AS w ON w.id = wm.workspace_id
       WHERE wm.user_id = ?
         AND wm.status = 'active'
         AND w.status = 'active'
       ORDER BY w.name COLLATE NOCASE, w.id`,
    )
    .bind(user.id)
    .all<WorkspaceMembershipRow>();

  const workspaces = membershipResult.results.map((membership) => ({
    id: membership.id,
    slug: membership.slug,
    name: membership.name,
    locale: membership.locale,
    currency: membership.currency,
    role: membership.role,
  }));
  const currentWorkspace = chooseCurrentWorkspace(
    workspaces,
    requestedWorkspaceId,
    user.last_workspace_id,
  );

  if (!user.access_subject) {
    const bindingResult = await db
      .prepare(
        `UPDATE users
         SET access_subject = ?, last_workspace_id = ?,
             last_seen_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND access_subject IS NULL AND status = 'active'
           AND EXISTS (
             SELECT 1
             FROM workspace_memberships AS wm
             INNER JOIN workspaces AS w ON w.id = wm.workspace_id
             WHERE wm.user_id = users.id
               AND wm.workspace_id = ?2
               AND wm.status = 'active'
               AND w.status = 'active'
           )`,
      )
      .bind(identity.subject, currentWorkspace.id, user.id)
      .run();

    if (bindingResult.meta.changes !== 1) {
      const boundUser = await db
        .prepare(
          `SELECT u.access_subject,
                  EXISTS (
                    SELECT 1
                    FROM workspace_memberships AS wm
                    INNER JOIN workspaces AS w ON w.id = wm.workspace_id
                    WHERE wm.user_id = u.id
                      AND wm.workspace_id = ?2
                      AND wm.status = 'active'
                      AND w.status = 'active'
                  ) AS has_active_membership
           FROM users AS u
           WHERE u.id = ?1 AND u.status = 'active'`,
        )
        .bind(user.id, currentWorkspace.id)
        .first<ActiveBoundSubjectRow>();

      if (
        boundUser?.access_subject &&
        boundUser.access_subject !== identity.subject
      ) {
        throw identityBindingConflict();
      }
      if (
        boundUser?.access_subject !== identity.subject ||
        boundUser.has_active_membership !== 1
      ) {
        throw inviteRequired();
      }
    }
  } else if (currentWorkspace.id !== user.last_workspace_id) {
    const switchResult = await db
      .prepare(
        `UPDATE users
         SET last_workspace_id = ?, last_seen_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND access_subject = ? AND status = 'active'
           AND EXISTS (
             SELECT 1
             FROM workspace_memberships AS wm
             INNER JOIN workspaces AS w ON w.id = wm.workspace_id
             WHERE wm.user_id = users.id
               AND wm.workspace_id = ?1
               AND wm.status = 'active'
               AND w.status = 'active'
           )`,
      )
      .bind(currentWorkspace.id, user.id, identity.subject)
      .run();
    if (switchResult.meta.changes !== 1) {
      throw workspaceForbidden();
    }
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      displayName:
        user.display_name?.trim() || identity.displayName || user.email,
    },
    currentWorkspace,
    workspaces,
  };
}
