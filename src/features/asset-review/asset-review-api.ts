import { z } from "zod";

import {
  assetReviewItemSchema,
  assetReviewQueueResponseSchema,
  type AssetReviewItem,
  type AssetReviewMutation,
} from "../../shared/domain/assets";

const apiErrorSchema = z.object({
  error: z.object({
    code: z.string().min(1),
  }),
});

export class AssetReviewApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
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
  );
}

export async function fetchAssetReviewQueue(
  signal: AbortSignal,
  workspaceId: string,
): Promise<AssetReviewItem[]> {
  const response = await fetch("/api/assets/review-queue", {
    credentials: "same-origin",
    headers: {
      accept: "application/json",
      "x-rigstage-workspace-id": workspaceId,
    },
    signal,
  });

  if (!response.ok) {
    throw await apiError(response);
  }

  return assetReviewQueueResponseSchema.parse(await response.json()).items;
}

export async function updateAssetReview(
  workspaceId: string,
  assetId: string,
  mutation: AssetReviewMutation,
): Promise<AssetReviewItem> {
  const response = await fetch(
    `/api/assets/${encodeURIComponent(assetId)}/review`,
    {
      method: "PATCH",
      credentials: "same-origin",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-rigstage-workspace-id": workspaceId,
      },
      body: JSON.stringify(mutation),
    },
  );

  if (!response.ok) {
    throw await apiError(response);
  }

  return assetReviewItemSchema.parse(await response.json());
}
