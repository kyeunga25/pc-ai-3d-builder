import { afterEach, describe, expect, it, vi } from "vitest";

import { reviewAsset } from "../../shared/domain/mockData";
import {
  acquireGenerationRequestLease,
  AssetReviewApiError,
  cancelGenerationJob,
  createAssetFromSource,
  fetchAssetFileBlob,
  fetchGenerationJobs,
  removeAssetFile,
  fetchAssetReview,
  fetchAssetReviewQueue,
  shouldRetainGenerationRequestLease,
  startGenerationJob,
  uploadAssetFile,
  updateAssetReview,
} from "./asset-review-api";
import { assetReviewCursorHeader } from "../../shared/lib/asset-review-pagination";

const leaseInput = {
  workspaceId: "workspace-fixture",
  assetId: "asset-fixture",
  expectedVersion: 2,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("asset review API errors", () => {
  it("uses a bilingual safe fallback when the response has no public message", () => {
    expect(
      new AssetReviewApiError(503, "ASSET_REVIEW_UNAVAILABLE").message,
    ).toBe(
      "暫時無法完成素材審核操作。 / Unable to complete the asset review operation right now.",
    );
  });
});

describe("generation request idempotency lease", () => {
  it("reuses one in-memory key for the same workspace asset version", () => {
    let created = 0;
    const createKey = () => `request-fixture-${(created += 1)}`;
    const first = acquireGenerationRequestLease(null, leaseInput, createKey);
    const repeated = acquireGenerationRequestLease(
      first,
      leaseInput,
      createKey,
    );

    expect(repeated).toBe(first);
    expect(repeated.idempotencyKey).toBe("request-fixture-1");
    expect(created).toBe(1);
  });

  it("rotates the key when the workspace asset or version changes", () => {
    let created = 0;
    const createKey = () => `request-fixture-${(created += 1)}`;
    const first = acquireGenerationRequestLease(null, leaseInput, createKey);
    const changedVersion = acquireGenerationRequestLease(
      first,
      { ...leaseInput, expectedVersion: 3 },
      createKey,
    );
    const changedAsset = acquireGenerationRequestLease(
      changedVersion,
      { ...leaseInput, assetId: "asset-other", expectedVersion: 3 },
      createKey,
    );

    expect(changedVersion.idempotencyKey).toBe("request-fixture-2");
    expect(changedAsset.idempotencyKey).toBe("request-fixture-3");
  });

  it("retains only ambiguous network, parsing or unknown server failures", () => {
    expect(shouldRetainGenerationRequestLease(new TypeError("offline"))).toBe(
      true,
    );
    expect(
      shouldRetainGenerationRequestLease(
        new AssetReviewApiError(500, "ASSET_REVIEW_UNAVAILABLE"),
      ),
    ).toBe(true);
    expect(
      shouldRetainGenerationRequestLease(
        new AssetReviewApiError(409, "GENERATION_ALREADY_ACTIVE"),
      ),
    ).toBe(false);
    expect(
      shouldRetainGenerationRequestLease(
        new AssetReviewApiError(503, "GENERATION_START_FAILED"),
      ),
    ).toBe(false);
  });
});

describe("generation request API", () => {
  it("sends the caller lease key only in the protected request header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json(
        {
          id: "generation-fixture",
          assetId: "asset-fixture",
          status: "queued",
          kind: "simulation",
          outputReady: false,
          failureCode: null,
          entitlementStatus: "reserved",
          providerCostUnits: null,
          validationCode: null,
          createdAt: "2026-08-10T00:00:00Z",
          updatedAt: "2026-08-10T00:00:00Z",
        },
        { status: 202 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      startGenerationJob(
        leaseInput.workspaceId,
        leaseInput.assetId,
        { expectedVersion: leaseInput.expectedVersion },
        "request-stable-001",
      ),
    ).resolves.toMatchObject({ id: "generation-fixture" });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(url).toBe("/api/assets/item/generation-jobs");
    expect(url).not.toContain(leaseInput.assetId);
    expect(headers.get("x-rigstage-asset-id")).toBe(leaseInput.assetId);
    expect(headers.get("idempotency-key")).toBe("request-stable-001");
    expect(url).not.toContain("request-stable-001");
    expect(String(init.body)).not.toContain("request-stable-001");
    expect(String(init.body)).not.toContain(leaseInput.assetId);
  });

  it("keeps the private asset ID out of the job-list URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        capability: {
          mode: "disabled",
          maxCostMinor: 0,
          credits: {
            availableUnits: 0,
            reservedUnits: 0,
            settledUnits: 0,
            releasedUnits: 0,
          },
        },
        items: [],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchGenerationJobs(
        new AbortController().signal,
        leaseInput.workspaceId,
        leaseInput.assetId,
      ),
    ).resolves.toMatchObject({ items: [] });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(url).toBe("/api/assets/item/generation-jobs");
    expect(url).not.toContain(leaseInput.assetId);
    expect(init.body).toBeUndefined();
    expect(headers.get("x-rigstage-asset-id")).toBe(leaseInput.assetId);
  });

  it("cancels one exact queued job with a bodyless protected request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        id: "generation-private-fixture",
        assetId: leaseInput.assetId,
        status: "cancelled",
        kind: "simulation",
        outputReady: false,
        failureCode: null,
        entitlementStatus: "released",
        providerCostUnits: null,
        validationCode: null,
        createdAt: "2026-08-10T00:00:00Z",
        updatedAt: "2026-08-10T00:01:00Z",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      cancelGenerationJob(
        leaseInput.workspaceId,
        leaseInput.assetId,
        "generation-private-fixture",
      ),
    ).resolves.toMatchObject({
      status: "cancelled",
      entitlementStatus: "released",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(url).toBe("/api/assets/item/generation-jobs");
    expect(url).not.toContain(leaseInput.assetId);
    expect(url).not.toContain("generation-private-fixture");
    expect(init.method).toBe("DELETE");
    expect(init.body).toBeUndefined();
    expect(headers.get("x-rigstage-asset-id")).toBe(leaseInput.assetId);
    expect(headers.get("x-rigstage-generation-job-id")).toBe(
      "generation-private-fixture",
    );
  });
});

describe("catalogue source target API", () => {
  it("keeps the private part ID out of the source upload URL and body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(reviewAsset));
    vi.stubGlobal("fetch", fetchMock);
    const source = new File([new Uint8Array([0x89])], "fixture.png", {
      type: "application/octet-stream",
    });
    const sourceUpload = {
      contentType: "image/png" as const,
      file: source,
      kind: "source" as const,
    };

    await expect(
      createAssetFromSource(
        "workspace-fixture",
        "part-private-fixture",
        sourceUpload,
      ),
    ).resolves.toEqual(reviewAsset);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(url).toBe("/api/catalogue/part/source");
    expect(url).not.toContain("part-private-fixture");
    expect(url).not.toContain(source.name);
    expect(String(init.body)).not.toContain("part-private-fixture");
    expect(String(init.body)).not.toContain(source.name);
    expect(init.body).toBe(source);
    expect(headers.get("x-rigstage-catalogue-part-id")).toBe(
      "part-private-fixture",
    );
    expect(headers.get("x-rigstage-workspace-id")).toBe("workspace-fixture");
    expect(headers.get("x-requested-with")).toBe("XMLHttpRequest");
    expect(headers.get("content-type")).toBe("image/png");
    expect(JSON.stringify([...headers.entries()])).not.toContain(source.name);
  });
});

describe("asset review target API", () => {
  it("keeps the opaque queue cursor in a protected header and returns the full page", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json({ items: [reviewAsset], nextCursor: "cursor_next_001" }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchAssetReviewQueue(
        new AbortController().signal,
        "workspace-fixture",
        "cursor_current_001",
      ),
    ).resolves.toMatchObject({
      items: [{ id: reviewAsset.id }],
      nextCursor: "cursor_next_001",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(url).toBe("/api/assets/review-queue");
    expect(url).not.toContain("cursor_current_001");
    expect(headers.get(assetReviewCursorHeader)).toBe("cursor_current_001");
    expect(init.body).toBeUndefined();
  });

  it("keeps the private asset ID out of the detail URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(reviewAsset));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchAssetReview(
        new AbortController().signal,
        "workspace-fixture",
        "asset-private-fixture",
      ),
    ).resolves.toEqual(reviewAsset);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(url).toBe("/api/assets/item");
    expect(url).not.toContain("asset-private-fixture");
    expect(init.body).toBeUndefined();
    expect(headers.get("x-rigstage-asset-id")).toBe("asset-private-fixture");
    expect(headers.get("x-rigstage-workspace-id")).toBe("workspace-fixture");
  });

  it("keeps the private asset ID out of the review URL and body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(reviewAsset));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      updateAssetReview("workspace-fixture", "asset-private-fixture", {
        action: "save_draft",
        expectedVersion: reviewAsset.version,
        completedChecks: [],
        dimensionsMm: { width: null, height: null, depth: null },
      }),
    ).resolves.toEqual(reviewAsset);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(url).toBe("/api/assets/item/review");
    expect(url).not.toContain("asset-private-fixture");
    expect(String(init.body)).not.toContain("asset-private-fixture");
    expect(headers.get("x-rigstage-asset-id")).toBe("asset-private-fixture");
    expect(headers.get("x-rigstage-workspace-id")).toBe("workspace-fixture");
    expect(headers.get("x-requested-with")).toBe("XMLHttpRequest");
  });
});

describe("private asset file target API", () => {
  it("keeps the private asset ID out of the replacement URL and body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(reviewAsset));
    vi.stubGlobal("fetch", fetchMock);
    const source = new File([new Uint8Array([0x89])], "fixture.png", {
      type: "application/octet-stream",
    });
    const sourceUpload = {
      contentType: "image/png" as const,
      file: source,
      kind: "source" as const,
    };

    await expect(
      uploadAssetFile(
        "workspace-fixture",
        "asset-private-fixture",
        3,
        sourceUpload,
        "three-quarter",
      ),
    ).resolves.toEqual(reviewAsset);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(url).toBe("/api/assets/item/file");
    expect(url).not.toContain("asset-private-fixture");
    expect(url).not.toContain(source.name);
    expect(init.body).toBe(source);
    expect(String(init.body)).not.toContain("asset-private-fixture");
    expect(String(init.body)).not.toContain(source.name);
    expect(headers.get("x-rigstage-asset-id")).toBe("asset-private-fixture");
    expect(headers.get("x-rigstage-asset-file-kind")).toBe("source");
    expect(headers.get("x-rigstage-asset-source-view")).toBe("three-quarter");
    expect(headers.get("x-rigstage-expected-version")).toBe("3");
    expect(headers.get("content-type")).toBe("image/png");
    expect(JSON.stringify([...headers.entries()])).not.toContain(source.name);
  });

  it("keeps the private asset ID out of the protected file-read URL", async () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(bytes, { headers: { "content-type": "image/png" } }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const blob = await fetchAssetFileBlob(
      new AbortController().signal,
      "workspace-fixture",
      "asset-private-fixture",
      "source",
      "left",
    );

    expect(blob.size).toBe(bytes.byteLength);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(url).toBe("/api/assets/item/file");
    expect(url).not.toContain("asset-private-fixture");
    expect(init.body).toBeUndefined();
    expect(headers.get("x-rigstage-asset-id")).toBe("asset-private-fixture");
    expect(headers.get("x-rigstage-asset-file-kind")).toBe("source");
    expect(headers.get("x-rigstage-asset-source-view")).toBe("left");
  });

  it("never sends a source-view header for a model request", async () => {
    const model = new File(
      [new Uint8Array([0x67, 0x6c, 0x54, 0x46])],
      "fixture.glb",
      {
        type: "application/octet-stream",
      },
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(reviewAsset))
      .mockResolvedValueOnce(
        new Response(model, {
          headers: { "content-type": "model/gltf-binary" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await uploadAssetFile("workspace-fixture", "asset-private-fixture", 3, {
      contentType: "model/gltf-binary",
      file: model,
      kind: "model",
    });
    await fetchAssetFileBlob(
      new AbortController().signal,
      "workspace-fixture",
      "asset-private-fixture",
      "model",
    );

    const [, uploadInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(uploadInit.body).toBe(model);
    expect(new Headers(uploadInit.headers).get("content-type")).toBe(
      "model/gltf-binary",
    );
    expect(
      JSON.stringify([...new Headers(uploadInit.headers).entries()]),
    ).not.toContain(model.name);
    expect(String(uploadInit.body)).not.toContain(model.name);

    for (const call of fetchMock.mock.calls) {
      const [, init] = call as [string, RequestInit];
      expect(
        new Headers(init.headers).has("x-rigstage-asset-source-view"),
      ).toBe(false);
    }
  });

  it("removes a selected source view without putting the asset ID in URL or body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json(reviewAsset, {
        headers: { "x-rigstage-generation-credit-released": "true" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await removeAssetFile(
      "workspace-fixture",
      "asset-private-fixture",
      "source",
      4,
      "back",
    );

    expect(result).toEqual({
      asset: reviewAsset,
      reservedGenerationReleased: true,
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(url).toBe("/api/assets/item/file");
    expect(url).not.toContain("asset-private-fixture");
    expect(init.method).toBe("DELETE");
    expect(init.body).toBeUndefined();
    expect(headers.get("x-rigstage-asset-id")).toBe("asset-private-fixture");
    expect(headers.get("x-rigstage-asset-file-kind")).toBe("source");
    expect(headers.get("x-rigstage-asset-source-view")).toBe("back");
    expect(headers.get("x-rigstage-expected-version")).toBe("4");
  });

  it("omits the source-view header when removing a model", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json(reviewAsset, {
        headers: { "x-rigstage-generation-credit-released": "false" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await removeAssetFile(
      "workspace-fixture",
      "asset-private-fixture",
      "model",
      4,
    );

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).has("x-rigstage-asset-source-view")).toBe(
      false,
    );
  });

  it("fails closed when a successful removal omits its credit outcome", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json(reviewAsset)),
    );

    await expect(
      removeAssetFile(
        "workspace-fixture",
        "asset-private-fixture",
        "source",
        4,
      ),
    ).rejects.toMatchObject({
      status: 502,
      code: "INVALID_RESPONSE",
      message: expect.stringContaining("Unable to confirm"),
    });
  });
});
