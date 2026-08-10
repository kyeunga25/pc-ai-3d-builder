import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BuildStatusBar } from "./BuildStatusBar";

describe("BuildStatusBar critical actions", () => {
  it("labels save and privacy-safe export in Traditional Chinese and English", () => {
    const markup = renderToStaticMarkup(
      createElement(BuildStatusBar, {
        summary: {
          passCount: 6,
          warningCount: 0,
          errorCount: 0,
          unknownCount: 0,
        },
        selectedCount: 9,
        totalPriceMinor: 100_000,
        canSave: true,
        canExport: true,
        busy: false,
        onSave() {},
        onExport() {},
      }),
    );

    expect(markup).toContain("儲存");
    expect(markup).toContain('<span lang="en">Save</span>');
    expect(markup).toContain("匯出");
    expect(markup).toContain('<span lang="en">Export</span>');
    expect(markup).toContain(
      "Export JSON without identity, pricing, stock or private assets",
    );
  });
});
