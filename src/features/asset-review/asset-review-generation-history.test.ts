import { describe, expect, it } from "vitest";

import type { GenerationJob } from "../../shared/domain/generation-jobs";
import {
  assetReviewGenerationHistoryCountCopy,
  assetReviewGenerationHistoryForAsset,
  assetReviewGenerationTime,
  generationHistoryCopy,
  generationHistoryLimit,
} from "./asset-review-generation-history";

function job(id: string, assetId = "asset-history-fixture"): GenerationJob {
  return {
    id,
    assetId,
    status: "cancelled",
    kind: "simulation",
    outputReady: false,
    failureCode: null,
    entitlementStatus: "released",
    providerCostUnits: null,
    validationCode: null,
    createdAt: "2026-08-30T00:00:00Z",
    updatedAt: "2026-08-30 01:02:03",
  };
}

describe("Asset Review generation history", () => {
  it("keeps only the current asset in server order and caps the visible history", () => {
    const matching = Array.from(
      { length: generationHistoryLimit + 2 },
      (_, index) => job(`generation-history-${index}`),
    );
    const result = assetReviewGenerationHistoryForAsset(
      [job("generation-foreign", "asset-foreign"), ...matching],
      "asset-history-fixture",
    );

    expect(result).toHaveLength(generationHistoryLimit);
    expect(result.map((item) => item.id)).toEqual(
      matching.slice(0, generationHistoryLimit).map((item) => item.id),
    );
    expect(result).not.toContainEqual(
      expect.objectContaining({ assetId: "asset-foreign" }),
    );
  });

  it("formats ISO and D1 timestamps in Hong Kong time and fails closed", () => {
    const iso = assetReviewGenerationTime("2026-08-30T00:00:00Z");
    const d1 = assetReviewGenerationTime("2026-08-30 01:02:03");

    expect(iso.dateTime).toBe("2026-08-30T00:00:00.000Z");
    expect(iso.copy.zhHant).toContain("2026");
    expect(iso.copy.english).toContain("30 Aug 2026");
    expect(iso.copy.english).toContain("08:00");
    expect(d1.dateTime).toBe("2026-08-30T01:02:03.000Z");
    expect(assetReviewGenerationTime("not-a-time")).toEqual({
      dateTime: null,
      copy: generationHistoryCopy.invalidTime,
    });
    expect(assetReviewGenerationTime("August 30, 2026")).toEqual({
      dateTime: null,
      copy: generationHistoryCopy.invalidTime,
    });
    expect(assetReviewGenerationTime("2026-02-30T00:00:00Z")).toEqual({
      dateTime: null,
      copy: generationHistoryCopy.invalidTime,
    });
  });

  it("uses bilingual singular, plural and privacy guidance", () => {
    expect(assetReviewGenerationHistoryCountCopy(1)).toEqual({
      zhHant: "顯示 1 項",
      english: "Showing 1 job",
    });
    expect(assetReviewGenerationHistoryCountCopy(20)).toEqual({
      zhHant: "顯示 20 項",
      english: "Showing 20 jobs",
    });
    expect(generationHistoryCopy.description.zhHant).toContain("不顯示工作 ID");
    expect(generationHistoryCopy.description.english).toContain("No job ID");
    for (const value of Object.values(generationHistoryCopy)) {
      expect(value.zhHant).toMatch(/[\u3400-\u9fff]/u);
      expect(value.english).toMatch(/[A-Za-z]/u);
    }
  });
});
