import {
  workspaceActivityResponseSchema,
  type WorkspaceActivityResponse,
} from "../../shared/domain/workspace-activity";
import { apiFetch } from "../../shared/lib/api-fetch";
import { workspaceActivityCursorHeader } from "../../shared/lib/workspace-activity-pagination";

export class WorkspaceActivityApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "WorkspaceActivityApiError";
  }
}

async function assertResponse(response: Response): Promise<void> {
  if (response.ok) return;
  const body = (await response.json().catch(() => null)) as {
    error?: { code?: unknown; message?: unknown };
  } | null;
  throw new WorkspaceActivityApiError(
    response.status,
    typeof body?.error?.code === "string"
      ? body.error.code
      : "WORKSPACE_ACTIVITY_REQUEST_FAILED",
    typeof body?.error?.message === "string"
      ? body.error.message
      : "暫時無法載入活動記錄。 / Unable to load the activity log right now.",
  );
}

export async function fetchWorkspaceActivityPage(
  signal: AbortSignal,
  workspaceId: string,
  cursor: string | null = null,
): Promise<WorkspaceActivityResponse> {
  const headers = new Headers({
    accept: "application/json",
    "x-rigstage-workspace-id": workspaceId,
  });
  if (cursor !== null) headers.set(workspaceActivityCursorHeader, cursor);
  const response = await apiFetch("/api/workspace/activity", {
    credentials: "same-origin",
    headers,
    signal,
  });
  await assertResponse(response);
  return workspaceActivityResponseSchema.parse(await response.json());
}
