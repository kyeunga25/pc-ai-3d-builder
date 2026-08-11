import {
  sessionResponseSchema,
  type SessionResponse,
} from "../../shared/domain/session";
import { apiFetch } from "../../shared/lib/api-fetch";
import type { SessionError } from "./session-context";

async function requestSession(
  path: string,
  init: RequestInit,
): Promise<SessionResponse> {
  const response = await apiFetch(path, {
    ...init,
    credentials: "same-origin",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { code?: unknown };
    } | null;
    const code =
      typeof body?.error?.code === "string"
        ? body.error.code
        : "SESSION_UNAVAILABLE";
    throw { status: response.status, code } satisfies SessionError;
  }

  return sessionResponseSchema.parse(await response.json());
}

export function fetchSession(signal: AbortSignal): Promise<SessionResponse> {
  return requestSession("/api/session", {
    headers: { accept: "application/json" },
    signal,
  });
}

export async function selectWorkspaceSession(
  signal: AbortSignal,
  workspaceId: string,
): Promise<SessionResponse> {
  const session = await requestSession("/api/session/workspace", {
    method: "PUT",
    headers: {
      accept: "application/json",
      "x-rigstage-workspace-id": workspaceId,
    },
    signal,
  });
  if (session.currentWorkspace.id !== workspaceId) {
    throw {
      status: 0,
      code: "WORKSPACE_SELECTION_MISMATCH",
    } satisfies SessionError;
  }
  return session;
}
