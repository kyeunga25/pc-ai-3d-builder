import {
  buildCreateInputSchema,
  buildListResponseSchema,
  buildMutationSchema,
  buildRecordSchema,
  type BuildCreateInput,
  type BuildListItem,
  type BuildMutation,
  type BuildRecord,
} from "../../shared/domain/builds";
import { apiFetch } from "../../shared/lib/api-fetch";
import { buildTargetHeader } from "../../shared/lib/build-target";

export class BuildRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "BuildRequestError";
  }
}

function workspaceHeaders(workspaceId: string): Headers {
  return new Headers({
    accept: "application/json",
    "x-rigstage-workspace-id": workspaceId,
  });
}

function buildTargetHeaders(workspaceId: string, buildId: string): Headers {
  const headers = workspaceHeaders(workspaceId);
  headers.set(buildTargetHeader, buildId);
  return headers;
}

async function buildError(response: Response): Promise<BuildRequestError> {
  const body = (await response.json().catch(() => null)) as {
    error?: { code?: unknown; message?: unknown };
  } | null;
  return new BuildRequestError(
    response.status,
    typeof body?.error?.code === "string"
      ? body.error.code
      : "BUILD_REQUEST_FAILED",
    typeof body?.error?.message === "string"
      ? body.error.message
      : "無法完成組裝操作。 / Unable to complete the build operation.",
  );
}

export async function fetchBuildList(
  signal: AbortSignal,
  workspaceId: string,
): Promise<BuildListItem[]> {
  const response = await apiFetch("/api/builds", {
    credentials: "same-origin",
    headers: workspaceHeaders(workspaceId),
    signal,
  });
  if (!response.ok) {
    throw await buildError(response);
  }
  return buildListResponseSchema.parse(await response.json()).items;
}

export async function fetchBuild(
  signal: AbortSignal,
  workspaceId: string,
  buildId: string,
): Promise<BuildRecord> {
  const response = await apiFetch("/api/build", {
    credentials: "same-origin",
    headers: buildTargetHeaders(workspaceId, buildId),
    signal,
  });
  if (!response.ok) {
    throw await buildError(response);
  }
  return buildRecordSchema.parse(await response.json());
}

export async function createBuild(
  workspaceId: string,
  input: BuildCreateInput,
): Promise<BuildRecord> {
  const headers = workspaceHeaders(workspaceId);
  headers.set("content-type", "application/json");
  const response = await apiFetch("/api/builds", {
    method: "POST",
    credentials: "same-origin",
    headers,
    body: JSON.stringify(buildCreateInputSchema.parse(input)),
  });
  if (!response.ok) {
    throw await buildError(response);
  }
  return buildRecordSchema.parse(await response.json());
}

export async function mutateBuild(
  workspaceId: string,
  buildId: string,
  mutation: BuildMutation,
): Promise<BuildRecord | null> {
  const headers = buildTargetHeaders(workspaceId, buildId);
  headers.set("content-type", "application/json");
  const response = await apiFetch("/api/build", {
    method: "PATCH",
    credentials: "same-origin",
    headers,
    body: JSON.stringify(buildMutationSchema.parse(mutation)),
  });
  if (!response.ok) {
    throw await buildError(response);
  }
  if (response.status === 204) {
    return null;
  }
  return buildRecordSchema.parse(await response.json());
}

export async function fetchBuildExport(
  workspaceId: string,
  buildId: string,
): Promise<Blob> {
  const response = await apiFetch("/api/build/export", {
    credentials: "same-origin",
    headers: buildTargetHeaders(workspaceId, buildId),
  });
  if (!response.ok) {
    throw await buildError(response);
  }
  return response.blob();
}
