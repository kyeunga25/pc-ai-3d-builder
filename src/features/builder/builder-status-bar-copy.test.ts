import { describe, expect, it } from "vitest";

import {
  builderCompatibilitySummaryPresentation,
  builderSelectedComponentsCopy,
  builderStatusBarCopy,
  builderStatusBarExportTitle,
} from "./builder-status-bar-copy";

describe("Builder status bar copy", () => {
  it("keeps every static label bilingual", () => {
    for (const copy of Object.values(builderStatusBarCopy)) {
      expect(copy.zhHant).toMatch(/[\u3400-\u9fff]/u);
      expect(copy.english).toMatch(/[A-Za-z]/u);
    }
  });

  it("preserves error, unknown, warning and success precedence", () => {
    expect(
      builderCompatibilitySummaryPresentation({
        errorCount: 2,
        unknownCount: 3,
        warningCount: 4,
        passCount: 1,
      }),
    ).toMatchObject({ tone: "error", copy: { english: "2 critical errors" } });
    expect(
      builderCompatibilitySummaryPresentation({
        errorCount: 0,
        unknownCount: 3,
        warningCount: 4,
        passCount: 1,
      }),
    ).toMatchObject({
      tone: "unknown",
      copy: { english: "3 unknown results" },
    });
    expect(
      builderCompatibilitySummaryPresentation({
        errorCount: 0,
        unknownCount: 0,
        warningCount: 4,
        passCount: 2,
      }),
    ).toMatchObject({
      tone: "warning",
      copy: { english: "4 warnings remaining" },
    });
    expect(
      builderCompatibilitySummaryPresentation({
        errorCount: 0,
        unknownCount: 0,
        warningCount: 0,
        passCount: 6,
      }),
    ).toMatchObject({
      tone: "success",
      copy: { english: "All available rules passed" },
    });
  });

  it("uses correct English singular and plural counts", () => {
    expect(
      builderCompatibilitySummaryPresentation({
        errorCount: 1,
        unknownCount: 0,
        warningCount: 0,
        passCount: 0,
      }).copy.english,
    ).toBe("1 critical error");
    expect(
      builderCompatibilitySummaryPresentation({
        errorCount: 0,
        unknownCount: 1,
        warningCount: 0,
        passCount: 0,
      }).copy.english,
    ).toBe("1 unknown result");
    expect(
      builderCompatibilitySummaryPresentation({
        errorCount: 0,
        unknownCount: 0,
        warningCount: 1,
        passCount: 0,
      }).copy.english,
    ).toBe("1 warning remaining");
    expect(builderSelectedComponentsCopy(1).english).toBe(
      "1 of 9 components selected",
    );
    expect(builderSelectedComponentsCopy(2).english).toBe(
      "2 of 9 components selected",
    );
  });

  it("keeps both export readiness explanations bilingual", () => {
    expect(builderStatusBarExportTitle(true)).toContain(
      "Export JSON without identity, pricing, stock or private assets",
    );
    expect(builderStatusBarExportTitle(false)).toContain(
      "Save changes and resolve errors and unknown compatibility results first",
    );
  });
});
