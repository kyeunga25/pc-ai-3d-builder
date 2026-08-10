import { describe, expect, it } from "vitest";

import {
  generationCapabilitySchema,
  generationEntitlementStatusSchema,
  generationJobStatusSchema,
  type GenerationJob,
} from "../../shared/domain/generation-jobs";
import {
  assetReviewGenerationCreditHistoryCopy,
  assetReviewGenerationCreditSummaryCopy,
  assetReviewGenerationEntitlementCopy,
  assetReviewGenerationModeCopy,
  assetReviewGenerationStatusCopy,
  generationEntitlementStatusCopy,
  generationInspectorCopy,
  generationJobStatusCopy,
  generationModeCopy,
} from "./asset-review-generation-copy";

const job: GenerationJob = {
  id: "generation-copy-fixture",
  assetId: "asset-copy-fixture",
  status: "queued",
  kind: "simulation",
  outputReady: false,
  failureCode: null,
  entitlementStatus: "reserved",
  providerCostUnits: null,
  validationCode: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function expectBilingual(copy: { english: string; zhHant: string }) {
  expect(copy.zhHant).toMatch(/[\u3400-\u9fff]/u);
  expect(copy.english).toMatch(/[A-Za-z]/u);
}

describe("Asset Review generation copy", () => {
  it("covers every generation and entitlement status bilingually", () => {
    expect(Object.keys(generationJobStatusCopy).sort()).toEqual(
      [...generationJobStatusSchema.options].sort(),
    );
    expect(Object.keys(generationEntitlementStatusCopy).sort()).toEqual(
      [...generationEntitlementStatusSchema.options].sort(),
    );
    expect(Object.keys(generationModeCopy).sort()).toEqual(
      [...generationCapabilitySchema.shape.mode.options].sort(),
    );
    Object.values(generationJobStatusCopy).forEach(expectBilingual);
    Object.values(generationEntitlementStatusCopy).forEach(expectBilingual);
    Object.values(generationModeCopy).forEach(expectBilingual);
  });

  it("distinguishes a settled human review from an awaiting decision", () => {
    expect(assetReviewGenerationStatusCopy(job)).toEqual({
      english: "Queued",
      zhHant: "已排入佇列",
    });
    expect(
      assetReviewGenerationStatusCopy({
        ...job,
        status: "awaiting_review",
        entitlementStatus: "settled",
      }),
    ).toEqual({
      english: "Human review approved",
      zhHant: "人工審核已核准",
    });
    expect(assetReviewGenerationEntitlementCopy("reserved")).toEqual({
      english: "Reserved, awaiting human decision",
      zhHant: "已保留，等待人工決定",
    });
  });

  it("labels modes and credit accounting without implying money", () => {
    expect(assetReviewGenerationModeCopy("simulation")).toEqual({
      english: "Zero-cost simulation",
      zhHant: "零成本模擬",
    });
    expect(assetReviewGenerationModeCopy("disabled")).toEqual({
      english: "Disabled",
      zhHant: "未啟用",
    });
    expect(
      assetReviewGenerationCreditSummaryCopy({
        availableUnits: 2,
        reservedUnits: 1,
        settledUnits: 3,
        releasedUnits: 4,
      }),
    ).toEqual({
      english: "2 available · 1 reserved",
      zhHant: "2 可用 · 1 保留",
    });
    expect(
      assetReviewGenerationCreditHistoryCopy({
        availableUnits: 2,
        reservedUnits: 1,
        settledUnits: 3,
        releasedUnits: 4,
      }),
    ).toEqual({
      english: "3 settled · 4 released",
      zhHant: "3 結算 · 4 釋放",
    });
    expect(generationInspectorCopy.credit.english).toContain("Non-monetary");
    expect(generationInspectorCopy.credit.zhHant).toContain("非貨幣");
  });

  it("keeps every inspector label and explanation bilingual", () => {
    Object.values(generationInspectorCopy).forEach(expectBilingual);
  });
});
