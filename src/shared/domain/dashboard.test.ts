import { describe, expect, it } from "vitest";

import { dashboardWorkItemSchema } from "./dashboard";

const assetReviewItem = {
  kind: "asset_review",
  title: "Fixture Asset",
  detailZhHant: "等待審核",
  statusZhHant: "需要審核",
  tone: "warning",
  href: "/asset-review",
  targetAssetId: "asset-fixture",
  updatedAt: "2026-08-10T09:00:00Z",
} as const;

describe("dashboard work item schema", () => {
  it("accepts an internal asset target only with the fixed review path", () => {
    expect(dashboardWorkItemSchema.parse(assetReviewItem)).toEqual(
      assetReviewItem,
    );
  });

  it("rejects asset identifiers serialized into links", () => {
    expect(() =>
      dashboardWorkItemSchema.parse({
        ...assetReviewItem,
        href: "/asset-review?asset=asset-fixture",
      }),
    ).toThrow();
  });

  it("rejects missing or cross-kind navigation targets", () => {
    expect(() =>
      dashboardWorkItemSchema.parse({
        ...assetReviewItem,
        targetAssetId: null,
      }),
    ).toThrow();
    expect(() =>
      dashboardWorkItemSchema.parse({
        ...assetReviewItem,
        kind: "build_ready",
        href: "/builder",
      }),
    ).toThrow();
  });
});
