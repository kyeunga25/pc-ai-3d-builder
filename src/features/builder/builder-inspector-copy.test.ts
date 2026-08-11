import { describe, expect, it } from "vitest";

import {
  builderInspectorAssetQualityCopy,
  builderInspectorAssetStatusCopy,
  builderInspectorCopy,
  builderInspectorSeverityCopy,
  builderInspectorSpecificationCopy,
  builderInspectorSpecificationLabelCopy,
  builderInspectorSpecificationStatusCopy,
  builderInspectorStockCopy,
  builderInspectorTabCopy,
  builderInspectorUsageCopy,
} from "./builder-inspector-copy";

describe("Builder inspector copy", () => {
  it("covers every bounded inspector enum exactly once", () => {
    expect(Object.keys(builderInspectorTabCopy)).toEqual([
      "details",
      "compatibility",
      "asset",
    ]);
    expect(Object.keys(builderInspectorSeverityCopy)).toEqual([
      "pass",
      "warning",
      "error",
      "unknown",
    ]);
    expect(Object.keys(builderInspectorAssetStatusCopy)).toEqual([
      "approved",
      "needs_review",
      "draft",
      "proxy",
    ]);
    expect(Object.keys(builderInspectorAssetQualityCopy)).toEqual([
      "unreviewed",
      "draft",
      "reviewed",
      "approved",
    ]);
    expect(Object.keys(builderInspectorSpecificationStatusCopy)).toEqual([
      "unverified",
      "verified",
    ]);
  });

  it("keeps every static, enum and known specification label bilingual", () => {
    const copies = [
      ...Object.values(builderInspectorCopy),
      ...Object.values(builderInspectorTabCopy),
      ...Object.values(builderInspectorSeverityCopy),
      ...Object.values(builderInspectorAssetStatusCopy),
      ...Object.values(builderInspectorAssetQualityCopy),
      ...Object.values(builderInspectorSpecificationStatusCopy),
      ...Object.values(builderInspectorSpecificationCopy),
    ];

    for (const copy of copies) {
      expect(copy.zhHant).toMatch(/[\u3400-\u9fff]/u);
      expect(copy.english).toMatch(/[A-Za-z]/u);
    }
  });

  it("formats stock counts with correct English plurality", () => {
    expect(builderInspectorStockCopy(null)).toEqual({
      english: "Stock count unavailable",
      zhHant: "庫存未提供",
    });
    expect(builderInspectorStockCopy(1).english).toBe("1 item in stock");
    expect(builderInspectorStockCopy(2).english).toBe("2 items in stock");
  });

  it("labels an unknown bounded catalogue field without guessing its meaning", () => {
    expect(builderInspectorSpecificationLabelCopy("custom.field")).toEqual({
      english: "Custom field: custom.field",
      zhHant: "自訂欄位：custom.field",
    });
  });

  it("keeps manual-preview approval distinct from every other asset state", () => {
    expect(builderInspectorUsageCopy("approved").english).toBe(
      "Approved for manual preview",
    );
    for (const status of ["needs_review", "draft", "proxy"] as const) {
      expect(builderInspectorUsageCopy(status).english).toBe(
        "Not approved for use",
      );
    }
  });
});
