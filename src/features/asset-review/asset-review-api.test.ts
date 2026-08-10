import { afterEach, describe, expect, it, vi } from "vitest";

import { reviewAsset } from "../../shared/domain/mockData";
import {
  acquireGenerationRequestLease,
  AssetReviewApiError,
  createAssetFromSource,
  fetchAssetReview,
  shouldRetainGenerationRequestLease,
  startGenerationJob,
  updateAssetReview,
} from "./asset-review-api";

const leaseInput = {
  workspaceId: "workspace-fixture",
  assetId: "asset-fixture",
  expectedVersion: 2,
};

afterEach(() => {
  vi.unstubAllGlobals();
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
    expect(headers.get("idempotency-key")).toBe("request-stable-001");
    expect(url).not.toContain("request-stable-001");
    expect(String(init.body)).not.toContain("request-stable-001");
  });
});

describe("catalogue source target API", () => {
  it("keeps the private part ID out of the source upload URL and body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(reviewAsset));
    vi.stubGlobal("fetch", fetchMock);
    const source = new File([new Uint8Array([0x89])], "fixture.png", {
      type: "image/png",
    });

    await expect(
      createAssetFromSource(
        "workspace-fixture",
        "part-private-fixture",
        source,
      ),
    ).resolves.toEqual(reviewAsset);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(url).toBe("/api/catalogue/part/source");
    expect(url).not.toContain("part-private-fixture");
    expect(String(init.body)).not.toContain("part-private-fixture");
    expect(init.body).toBe(source);
    expect(headers.get("x-rigstage-catalogue-part-id")).toBe(
      "part-private-fixture",
    );
    expect(headers.get("x-rigstage-workspace-id")).toBe("workspace-fixture");
    expect(headers.get("x-requested-with")).toBe("XMLHttpRequest");
  });
});

describe("asset review target API", () => {
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
