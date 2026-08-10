import { readFile } from "node:fs/promises";

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
    expect(markup).toContain("Compatibility");
    expect(markup).toContain("All available rules passed");
    expect(markup).toContain("Selected components");
    expect(markup).toContain("9 of 9 components selected");
    expect(markup).toContain("Workspace total");
    expect(markup).toContain('aria-label="儲存 / Save"');
    expect(markup).toContain('aria-label="匯出 / Export"');
    expect(markup).toContain(
      'class="build-status-item build-status-item--success"',
    );
    expect(markup).toContain("lucide-circle-check");
  });

  it.each([
    [
      { passCount: 1, warningCount: 1, errorCount: 1, unknownCount: 1 },
      "error",
      "1 critical error",
      "lucide-triangle-alert",
    ],
    [
      { passCount: 1, warningCount: 1, errorCount: 0, unknownCount: 1 },
      "unknown",
      "1 unknown result",
      "lucide-circle-question-mark",
    ],
    [
      { passCount: 1, warningCount: 1, errorCount: 0, unknownCount: 0 },
      "warning",
      "1 warning remaining",
      "lucide-triangle-alert",
    ],
  ] as const)(
    "renders %s compatibility state with semantic icon and copy",
    (summary, tone, english, iconClass) => {
      const markup = renderToStaticMarkup(
        createElement(BuildStatusBar, {
          summary,
          selectedCount: 1,
          totalPriceMinor: 100_000,
          canSave: false,
          canExport: false,
          busy: false,
          onSave() {},
          onExport() {},
        }),
      );

      expect(markup).toContain(`build-status-item--${tone}`);
      expect(markup).toContain(english);
      expect(markup).toContain(iconClass);
      expect(markup).toContain(
        "Save changes and resolve errors and unknown compatibility results first",
      );
    },
  );

  it("keeps bilingual status copy wrapping at phone width", async () => {
    const styles = await readFile(
      new URL("./builder.css", import.meta.url),
      "utf8",
    );

    expect(styles).toMatch(
      /\.build-status-copy\s*\{[^}]*overflow-wrap:\s*anywhere;/u,
    );
    expect(styles).toMatch(
      /\.build-status-item strong\s*\{[^}]*white-space:\s*normal;/u,
    );
  });
});
