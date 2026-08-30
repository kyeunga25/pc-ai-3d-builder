import { z } from "zod";

import {
  type AssetFileKind,
  type AssetSourceView,
} from "../../shared/domain/asset-files";
import {
  assetReviewItemSchema,
  assetReviewQueueResponseSchema,
  type AssetReviewItem,
  type AssetReviewMutation,
  type AssetReviewQueueResponse,
} from "../../shared/domain/assets";
import {
  generationJobListResponseSchema,
  generationJobSchema,
  type GenerationJob,
  type GenerationJobStartInput,
} from "../../shared/domain/generation-jobs";
import { apiFetch } from "../../shared/lib/api-fetch";
import { assetReviewCursorHeader } from "../../shared/lib/asset-review-pagination";
import {
  assetFileKindHeader,
  assetGenerationCreditReleasedHeader,
  assetSourceViewHeader,
  assetTargetHeader,
  generationJobTargetHeader,
} from "../../shared/lib/asset-target";
import { cataloguePartTargetHeader } from "../../shared/lib/catalogue-target";
import type {
  ValidatedAssetUpload,
  ValidatedSourceUpload,
} from "./asset-upload-file";

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
    message = "暫時無法完成素材審核操作。 / Unable to complete the asset review operation right now.",
  ) {
    super(message);
    this.name = "AssetReviewApiError";
  }
}

type GenerationRequestLeaseInput = {
  assetId: string;
  expectedVersion: number;
  workspaceId: string;
};

export type GenerationRequestLease = GenerationRequestLeaseInput & {
  idempotencyKey: string;
};

export function acquireGenerationRequestLease(
  current: GenerationRequestLease | null,
  input: GenerationRequestLeaseInput,
  createKey: () => string = () => crypto.randomUUID(),
): GenerationRequestLease {
  if (
    current?.workspaceId === input.workspaceId &&
    current.assetId === input.assetId &&
    current.expectedVersion === input.expectedVersion
  ) {
    return current;
  }

  return { ...input, idempotencyKey: createKey() };
}

export function shouldRetainGenerationRequestLease(error: unknown): boolean {
  if (!(error instanceof AssetReviewApiError)) {
    return true;
  }

  return error.status >= 500 && error.code !== "GENERATION_START_FAILED";
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
  cursor: string | null = null,
): Promise<AssetReviewQueueResponse> {
  const headers = workspaceHeaders(workspaceId);
  if (cursor !== null) headers.set(assetReviewCursorHeader, cursor);
  const response = await apiFetch("/api/assets/review-queue", {
    credentials: "same-origin",
    headers,
    signal,
  });

  if (!response.ok) {
    throw await apiError(response);
  }

  return assetReviewQueueResponseSchema.parse(await response.json());
}

export async function fetchAssetReview(
  signal: AbortSignal,
  workspaceId: string,
  assetId: string,
): Promise<AssetReviewItem> {
  const headers = workspaceHeaders(workspaceId);
  headers.set(assetTargetHeader, assetId);
  const response = await apiFetch("/api/assets/item", {
    credentials: "same-origin",
    headers,
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
  headers.set(assetTargetHeader, assetId);
  const response = await apiFetch("/api/assets/item/review", {
    method: "PATCH",
    credentials: "same-origin",
    headers,
    body: JSON.stringify(mutation),
  });

  if (!response.ok) {
    throw await apiError(response);
  }

  return assetReviewItemSchema.parse(await response.json());
}

export async function createAssetFromSource(
  workspaceId: string,
  partId: string,
  upload: ValidatedSourceUpload,
): Promise<AssetReviewItem> {
  const headers = workspaceHeaders(workspaceId);
  headers.set("content-type", upload.contentType);
  headers.set(cataloguePartTargetHeader, partId);
  const response = await apiFetch("/api/catalogue/part/source", {
    method: "POST",
    credentials: "same-origin",
    headers,
    body: upload.file,
  });
  if (!response.ok) {
    throw await apiError(response);
  }
  return assetReviewItemSchema.parse(await response.json());
}

export async function uploadAssetFile(
  workspaceId: string,
  assetId: string,
  expectedVersion: number,
  upload: ValidatedAssetUpload,
  sourceView: AssetSourceView = "front",
): Promise<AssetReviewItem> {
  const headers = workspaceHeaders(workspaceId);
  headers.set("content-type", upload.contentType);
  headers.set(assetFileKindHeader, upload.kind);
  if (upload.kind === "source") headers.set(assetSourceViewHeader, sourceView);
  headers.set(assetTargetHeader, assetId);
  headers.set("x-rigstage-expected-version", String(expectedVersion));
  const response = await apiFetch("/api/assets/item/file", {
    method: "PUT",
    credentials: "same-origin",
    headers,
    body: upload.file,
  });
  if (!response.ok) {
    throw await apiError(response);
  }
  return assetReviewItemSchema.parse(await response.json());
}

export async function removeAssetFile(
  workspaceId: string,
  assetId: string,
  kind: AssetFileKind,
  expectedVersion: number,
  sourceView: AssetSourceView = "front",
): Promise<{
  asset: AssetReviewItem;
  reservedGenerationReleased: boolean;
}> {
  const headers = workspaceHeaders(workspaceId);
  headers.set(assetFileKindHeader, kind);
  if (kind === "source") headers.set(assetSourceViewHeader, sourceView);
  headers.set(assetTargetHeader, assetId);
  headers.set("x-rigstage-expected-version", String(expectedVersion));
  const response = await apiFetch("/api/assets/item/file", {
    method: "DELETE",
    credentials: "same-origin",
    headers,
  });
  if (!response.ok) {
    throw await apiError(response);
  }
  const released = response.headers.get(assetGenerationCreditReleasedHeader);
  if (released !== "true" && released !== "false") {
    throw new AssetReviewApiError(
      502,
      "INVALID_RESPONSE",
      "無法確認保留 credit 是否已處理；請重新載入素材及生成狀態。 / Unable to confirm whether reserved credit was handled. Reload the asset and generation status.",
    );
  }
  return {
    asset: assetReviewItemSchema.parse(await response.json()),
    reservedGenerationReleased: released === "true",
  };
}

export async function fetchAssetFileBlob(
  signal: AbortSignal,
  workspaceId: string,
  assetId: string,
  kind: AssetFileKind,
  sourceView: AssetSourceView = "front",
): Promise<Blob> {
  const headers = workspaceHeaders(workspaceId);
  headers.set(assetFileKindHeader, kind);
  if (kind === "source") headers.set(assetSourceViewHeader, sourceView);
  headers.set(assetTargetHeader, assetId);
  const response = await apiFetch("/api/assets/item/file", {
    credentials: "same-origin",
    headers,
    signal,
  });
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
  const headers = workspaceHeaders(workspaceId);
  headers.set(assetTargetHeader, assetId);
  const response = await apiFetch("/api/assets/item/generation-jobs", {
    credentials: "same-origin",
    headers,
    signal,
  });
  if (!response.ok) {
    throw await apiError(response);
  }
  return generationJobListResponseSchema.parse(await response.json());
}

export async function startGenerationJob(
  workspaceId: string,
  assetId: string,
  input: GenerationJobStartInput,
  idempotencyKey: string,
): Promise<GenerationJob> {
  const headers = workspaceHeaders(workspaceId);
  headers.set("content-type", "application/json");
  headers.set("idempotency-key", idempotencyKey);
  headers.set(assetTargetHeader, assetId);
  const response = await apiFetch("/api/assets/item/generation-jobs", {
    method: "POST",
    credentials: "same-origin",
    headers,
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw await apiError(response);
  }
  return generationJobSchema.parse(await response.json());
}

export async function cancelGenerationJob(
  workspaceId: string,
  assetId: string,
  jobId: string,
): Promise<GenerationJob> {
  const headers = workspaceHeaders(workspaceId);
  headers.set(assetTargetHeader, assetId);
  headers.set(generationJobTargetHeader, jobId);
  const response = await apiFetch("/api/assets/item/generation-jobs", {
    method: "DELETE",
    credentials: "same-origin",
    headers,
  });
  if (!response.ok) {
    throw await apiError(response);
  }
  return generationJobSchema.parse(await response.json());
}
