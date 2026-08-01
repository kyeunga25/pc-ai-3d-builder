import { z } from "zod";

import {
  type AssetFileKind,
  assetModelContentType,
} from "../../shared/domain/asset-files";
import {
  assetReviewItemSchema,
  assetReviewQueueResponseSchema,
  type AssetReviewItem,
  type AssetReviewMutation,
} from "../../shared/domain/assets";
import {
  generationJobListResponseSchema,
  generationJobSchema,
  type GenerationJob,
  type GenerationJobStartInput,
} from "../../shared/domain/generation-jobs";

const apiErrorSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1).optional(),
  }),
});

export class AssetReviewApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message = code,
  ) {
    super(message);
    this.name = "AssetReviewApiError";
  }
}

async function apiError(response: Response): Promise<AssetReviewApiError> {
  const parsed = apiErrorSchema.safeParse(
    await response.json().catch(() => null),
  );
  return new AssetReviewApiError(
    response.status,
    parsed.success ? parsed.data.error.code : "ASSET_REVIEW_UNAVAILABLE",
    parsed.success ? parsed.data.error.message : undefined,
  );
}

function workspaceHeaders(workspaceId: string): Headers {
  return new Headers({
    accept: "application/json",
    "x-rigstage-workspace-id": workspaceId,
  });
}

export async function fetchAssetReviewQueue(
  signal: AbortSignal,
  workspaceId: string,
): Promise<AssetReviewItem[]> {
  const response = await fetch("/api/assets/review-queue", {
    credentials: "same-origin",
    headers: workspaceHeaders(workspaceId),
    signal,
  });

  if (!response.ok) {
    throw await apiError(response);
  }

  return assetReviewQueueResponseSchema.parse(await response.json()).items;
}

export async function fetchAssetReview(
  signal: AbortSignal,
  workspaceId: string,
  assetId: string,
): Promise<AssetReviewItem> {
  const response = await fetch(`/api/assets/${encodeURIComponent(assetId)}`, {
    credentials: "same-origin",
    headers: workspaceHeaders(workspaceId),
    signal,
  });
  if (!response.ok) {
    throw await apiError(response);
  }
  return assetReviewItemSchema.parse(await response.json());
}

export async function updateAssetReview(
  workspaceId: string,
  assetId: string,
  mutation: AssetReviewMutation,
): Promise<AssetReviewItem> {
  const headers = workspaceHeaders(workspaceId);
  headers.set("content-type", "application/json");
  const response = await fetch(
    `/api/assets/${encodeURIComponent(assetId)}/review`,
    {
      method: "PATCH",
      credentials: "same-origin",
      headers,
      body: JSON.stringify(mutation),
    },
  );

  if (!response.ok) {
    throw await apiError(response);
  }

  return assetReviewItemSchema.parse(await response.json());
}

function uploadContentType(kind: AssetFileKind, file: File): string {
  return kind === "model" ? assetModelContentType : file.type.toLowerCase();
}

export async function createAssetFromSource(
  workspaceId: string,
  partId: string,
  file: File,
): Promise<AssetReviewItem> {
  const headers = workspaceHeaders(workspaceId);
  headers.set("content-type", uploadContentType("source", file));
  const response = await fetch(
    `/api/catalogue/${encodeURIComponent(partId)}/assets/source`,
    {
      method: "POST",
      credentials: "same-origin",
      headers,
      body: file,
    },
  );
  if (!response.ok) {
    throw await apiError(response);
  }
  return assetReviewItemSchema.parse(await response.json());
}

export async function uploadAssetFile(
  workspaceId: string,
  assetId: string,
  kind: AssetFileKind,
  expectedVersion: number,
  file: File,
): Promise<AssetReviewItem> {
  const headers = workspaceHeaders(workspaceId);
  headers.set("content-type", uploadContentType(kind, file));
  headers.set("x-rigstage-expected-version", String(expectedVersion));
  const response = await fetch(
    `/api/assets/${encodeURIComponent(assetId)}/files/${kind}`,
    {
      method: "PUT",
      credentials: "same-origin",
      headers,
      body: file,
    },
  );
  if (!response.ok) {
    throw await apiError(response);
  }
  return assetReviewItemSchema.parse(await response.json());
}

export async function fetchAssetFileBlob(
  signal: AbortSignal,
  workspaceId: string,
  assetId: string,
  kind: AssetFileKind,
): Promise<Blob> {
  const response = await fetch(
    `/api/assets/${encodeURIComponent(assetId)}/files/${kind}`,
    {
      credentials: "same-origin",
      headers: workspaceHeaders(workspaceId),
      signal,
    },
  );
  if (!response.ok) {
    throw await apiError(response);
  }
  return response.blob();
}

export async function fetchGenerationJobs(
  signal: AbortSignal,
  workspaceId: string,
  assetId: string,
) {
  const response = await fetch(
    `/api/assets/${encodeURIComponent(assetId)}/generation-jobs`,
    {
      credentials: "same-origin",
      headers: workspaceHeaders(workspaceId),
      signal,
    },
  );
  if (!response.ok) {
    throw await apiError(response);
  }
  return generationJobListResponseSchema.parse(await response.json());
}

export async function startGenerationJob(
  workspaceId: string,
  assetId: string,
  input: GenerationJobStartInput,
): Promise<GenerationJob> {
  const headers = workspaceHeaders(workspaceId);
  headers.set("content-type", "application/json");
  headers.set("idempotency-key", crypto.randomUUID());
  const response = await fetch(
    `/api/assets/${encodeURIComponent(assetId)}/generation-jobs`,
    {
      method: "POST",
      credentials: "same-origin",
      headers,
      body: JSON.stringify(input),
    },
  );
  if (!response.ok) {
    throw await apiError(response);
  }
  return generationJobSchema.parse(await response.json());
}
