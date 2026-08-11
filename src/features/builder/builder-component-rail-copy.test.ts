import { describe, expect, it } from "vitest";

import type { CompatibilityFinding } from "../../shared/domain/builds";
import { catalogParts } from "../../shared/domain/mockData";
import type { CatalogPart } from "../../shared/domain/schemas";
import {
  builderComponentCandidateStockCopy,
  builderComponentCandidatesCountCopy,
  builderComponentOptionsCopy,
  builderComponentRailCopy,
  builderComponentSelectedCategoriesCopy,
  builderComponentSelectedCountCopy,
  builderComponentStepCopy,
  builderComponentStepOrder,
  builderComponentStepState,
} from "./builder-component-rail-copy";

const selectedCpu: CatalogPart = catalogParts.find(
  (part) => part.category === "cpu",
)!;

function finding(
  severity: CompatibilityFinding["severity"],
): CompatibilityFinding {
  return {
    ruleId: "cpu_socket",
    severity,
    categories: ["cpu", "motherboard"],
    messageZhHant: "合成規則結果。",
    messageEn: "Synthetic rule result.",
    evidence: [],
  };
}

describe("Builder component rail copy", () => {
  it("covers all nine component categories and summary exactly once", () => {
    expect(builderComponentStepOrder).toEqual([
      "case",
      "motherboard",
      "cpu",
      "gpu",
      "memory",
      "cooling",
      "storage",
      "psu",
      "fans",
      "summary",
    ]);
    expect(Object.keys(builderComponentStepCopy)).toEqual(
      builderComponentStepOrder,
    );
  });

  it("keeps all static, full and compact labels bilingual", () => {
    const copies = [
      ...Object.values(builderComponentRailCopy),
      ...Object.values(builderComponentStepCopy).flatMap(({ full, short }) => [
        full,
        short,
      ]),
    ];

    for (const copy of copies) {
      expect(copy.zhHant).toMatch(/[\u3400-\u9fff]/u);
      expect(copy.english).toMatch(/[A-Za-z]/u);
    }
  });

  it("preserves step-state precedence and bilingual result labels", () => {
    expect(
      builderComponentStepState("cpu", [], [finding("error")]),
    ).toMatchObject({ tone: "error", copy: { english: "Error" } });
    expect(
      builderComponentStepState("cpu", [], [finding("warning")]),
    ).toMatchObject({ tone: "pending", copy: { english: "Not selected" } });
    expect(
      builderComponentStepState("cpu", [selectedCpu], [finding("unknown")]),
    ).toMatchObject({
      tone: "unknown",
      copy: { english: "Needs verification" },
    });
    expect(
      builderComponentStepState("cpu", [selectedCpu], [finding("warning")]),
    ).toMatchObject({ tone: "warning", copy: { english: "Warning" } });
    expect(builderComponentStepState("cpu", [selectedCpu], [])).toMatchObject({
      tone: "complete",
      copy: { english: "Selected" },
    });

    expect(
      builderComponentStepState("summary", [selectedCpu], [finding("error")]),
    ).toMatchObject({ tone: "error", copy: { english: "Has errors" } });
    expect(
      builderComponentStepState("summary", [selectedCpu], [finding("unknown")]),
    ).toMatchObject({
      tone: "unknown",
      copy: { english: "Needs verification" },
    });
    expect(
      builderComponentStepState("summary", [selectedCpu], [finding("warning")]),
    ).toMatchObject({ tone: "warning", copy: { english: "Has warnings" } });
    expect(
      builderComponentStepState("summary", [selectedCpu], []),
    ).toMatchObject({ tone: "complete", copy: { english: "Export ready" } });
  });

  it("formats bounded counts and category options with correct plurality", () => {
    expect(builderComponentSelectedCountCopy(1).english).toBe(
      "1 of 9 selected",
    );
    expect(builderComponentCandidatesCountCopy(1).english).toBe("1 option");
    expect(builderComponentCandidatesCountCopy(2).english).toBe("2 options");
    expect(builderComponentSelectedCategoriesCopy(1).english).toBe(
      "1 category selected",
    );
    expect(builderComponentSelectedCategoriesCopy(2).english).toBe(
      "2 categories selected",
    );
    expect(builderComponentOptionsCopy("gpu").english).toBe("GPU options");
  });

  it("distinguishes every candidate stock state without inventing stock", () => {
    expect(
      builderComponentCandidateStockCopy({
        stockCount: 3,
        stockStatus: "in_stock",
      }).english,
    ).toBe("3 items in stock");
    expect(
      builderComponentCandidateStockCopy({
        stockCount: 1,
        stockStatus: "low_stock",
      }).english,
    ).toBe("1 low-stock item");
    expect(
      builderComponentCandidateStockCopy({
        stockCount: 0,
        stockStatus: "out_of_stock",
      }).english,
    ).toBe("Currently out of stock");
    expect(
      builderComponentCandidateStockCopy({
        stockCount: null,
        stockStatus: "unknown",
      }).english,
    ).toBe("Stock unverified");
    expect(
      builderComponentCandidateStockCopy({
        stockCount: null,
        stockStatus: "in_stock",
      }).english,
    ).toBe("Stock count unavailable");
  });
});
