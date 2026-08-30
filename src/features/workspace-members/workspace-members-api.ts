import {
  workspaceMemberInviteSchema,
  workspaceMemberListResponseSchema,
  workspaceMemberSchema,
  workspaceMemberUpdateSchema,
  type WorkspaceMember,
  type WorkspaceMemberInvite,
  type WorkspaceMemberListResponse,
  type WorkspaceMemberUpdate,
} from "../../shared/domain/workspace-members";
import { apiFetch } from "../../shared/lib/api-fetch";
import { workspaceMemberCursorHeader } from "../../shared/lib/workspace-member-pagination";
import { workspaceMemberTargetHeader } from "../../shared/lib/workspace-member-target";

export class WorkspaceMemberApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "WorkspaceMemberApiError";
  }
}

function workspaceHeaders(workspaceId: string): Headers {
  return new Headers({
    accept: "application/json",
    "x-rigstage-workspace-id": workspaceId,
  });
}

async function assertResponse(response: Response): Promise<void> {
  if (response.ok) {
    return;
  }
  const body = (await response.json().catch(() => null)) as {
    error?: { code?: unknown; message?: unknown };
  } | null;
  throw new WorkspaceMemberApiError(
    response.status,
    typeof body?.error?.code === "string"
      ? body.error.code
      : "WORKSPACE_MEMBER_REQUEST_FAILED",
    typeof body?.error?.message === "string"
      ? body.error.message
      : "暫時無法完成成員操作。 / Unable to complete the member operation right now.",
  );
}

export async function fetchWorkspaceMembers(
  signal: AbortSignal,
  workspaceId: string,
  cursor: string | null = null,
): Promise<WorkspaceMemberListResponse> {
  const headers = workspaceHeaders(workspaceId);
  if (cursor !== null) headers.set(workspaceMemberCursorHeader, cursor);
  const response = await apiFetch("/api/workspace/members", {
    credentials: "same-origin",
    headers,
    signal,
  });
  await assertResponse(response);
  return workspaceMemberListResponseSchema.parse(await response.json());
}

export async function inviteWorkspaceMember(
  workspaceId: string,
  input: WorkspaceMemberInvite,
): Promise<WorkspaceMember> {
  const body = workspaceMemberInviteSchema.parse(input);
  const headers = workspaceHeaders(workspaceId);
  headers.set("content-type", "application/json");
  const response = await apiFetch("/api/workspace/members", {
    method: "POST",
    credentials: "same-origin",
    headers,
    body: JSON.stringify(body),
  });
  await assertResponse(response);
  return workspaceMemberSchema.parse(await response.json());
}

export async function updateWorkspaceMember(
  workspaceId: string,
  memberId: string,
  input: WorkspaceMemberUpdate,
): Promise<WorkspaceMember> {
  const body = workspaceMemberUpdateSchema.parse(input);
  const headers = workspaceHeaders(workspaceId);
  headers.set("content-type", "application/json");
  headers.set(workspaceMemberTargetHeader, memberId);
  const response = await apiFetch("/api/workspace/member", {
    method: "PATCH",
    credentials: "same-origin",
    headers,
    body: JSON.stringify(body),
  });
  await assertResponse(response);
  return workspaceMemberSchema.parse(await response.json());
}
