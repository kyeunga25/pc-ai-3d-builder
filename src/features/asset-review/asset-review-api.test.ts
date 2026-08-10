import { afterEach, describe, expect, it, vi } from "vitest";

import {
  acquireGenerationRequestLease,
  AssetReviewApiError,
  shouldRetainGenerationRequestLease,
  startGenerationJob,
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
