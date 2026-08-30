import type { WorkspaceRole } from "../../shared/domain/session";
import {
  isWorkspaceActivityCursor,
  normalizeWorkspaceActivityAction,
  safeWorkspaceActivityActorDisplayName,
  workspaceActivityCategoryForAction,
  workspaceActivityResponseSchema,
  type WorkspaceActivityItem,
} from "../../shared/domain/workspace-activity";
import { workspaceActivityCursorHeader } from "../../shared/lib/workspace-activity-pagination";
import type { RequestContext } from "../auth/workspace";
import { ApiError } from "../lib/api-error";

type WorkspaceActivityRow = {
  action: string;
  actor_display_name: string | null;
  created_at: string;
  id: string;
};

const pageSize = 50;

function roleForbidden(): ApiError {
  return new ApiError(
    403,
    "ROLE_FORBIDDEN",
    "你目前的工作空間角色無權查看活動記錄。 / Your current workspace role cannot view the activity log.",
  );
}

function validationError(): ApiError {
  return new ApiError(
    400,
    "VALIDATION_ERROR",
    "活動記錄分頁資料無效。 / The activity-log page cursor is invalid.",
  );
}

function assertManager(role: WorkspaceRole): void {
  if (role !== "owner" && role !== "admin") {
    throw roleForbidden();
  }
}

function mapActivityRow(row: WorkspaceActivityRow): WorkspaceActivityItem {
  const action = normalizeWorkspaceActivityAction(row.action);
  return {
    action,
    category: workspaceActivityCategoryForAction(action),
    actorDisplayName: safeWorkspaceActivityActorDisplayName(
      row.actor_display_name,
    ),
    createdAt: row.created_at,
  };
}

export async function workspaceActivityResponse(
  request: Request,
  db: D1Database,
  context: RequestContext,
): Promise<Response> {
  assertManager(context.currentWorkspace.role);
  const url = new URL(request.url);
  if (url.search.length > 0) {
    throw validationError();
  }

  const cursor = request.headers.get(workspaceActivityCursorHeader);
  const values: Array<number | string> = [context.currentWorkspace.id];
  let olderThanClause = "";
  if (cursor !== null) {
    if (!isWorkspaceActivityCursor(cursor)) {
      throw validationError();
    }
    const cursorRow = await db
      .prepare(
        `SELECT created_at
         FROM audit_events
         WHERE workspace_id = ?1 AND id = ?2
         LIMIT 1`,
      )
      .bind(context.currentWorkspace.id, cursor)
      .first<{ created_at: string }>();
    if (!cursorRow) {
      throw validationError();
    }
    olderThanClause =
      "AND (e.created_at < ?2 OR (e.created_at = ?2 AND e.id < ?3))";
    values.push(cursorRow.created_at, cursor);
  }
  values.push(pageSize + 1);

  const result = await db
    .prepare(
      `SELECT e.id, e.action, e.created_at,
              u.display_name AS actor_display_name
       FROM audit_events AS e
       LEFT JOIN users AS u ON u.id = e.user_id
       WHERE e.workspace_id = ?1
         ${olderThanClause}
       ORDER BY e.created_at DESC, e.id DESC
       LIMIT ?${values.length}`,
    )
    .bind(...values)
    .all<WorkspaceActivityRow>();

  const hasMore = result.results.length > pageSize;
  const rows = hasMore ? result.results.slice(0, pageSize) : result.results;
  return Response.json(
    workspaceActivityResponseSchema.parse({
      items: rows.map(mapActivityRow),
      nextCursor: hasMore ? (rows.at(-1)?.id ?? null) : null,
    }),
    { headers: { "cache-control": "private, no-store" } },
  );
}
