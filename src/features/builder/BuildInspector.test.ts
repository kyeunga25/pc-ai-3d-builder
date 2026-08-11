import { readFile } from "node:fs/promises";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CompatibilityFinding } from "../../shared/domain/builds";
import { catalogParts } from "../../shared/domain/mockData";
import type { CatalogPart } from "../../shared/domain/schemas";
import { BuildInspector, BuildInspectorPanel } from "./BuildInspector";

const part: CatalogPart = catalogParts[0]!;
const finding: CompatibilityFinding = {
  ruleId: "motherboard_form_factor",
  severity: "pass",
  categories: ["case", "motherboard"],
  messageZhHant: "主機板尺寸符合機箱支援清單。",
  messageEn: "The motherboard form factor is supported by the case.",
  evidence: [
    {
      labelZhHant: "主機板尺寸",
      labelEn: "Motherboard form factor",
      actual: "ATX",
      expected: "ATX, Micro-ATX, Mini-ITX",
    },
  ],
};

function renderPanel(
  tab: "asset" | "compatibility" | "details",
  selectedPart: CatalogPart = part,
  findings: CompatibilityFinding[] = [finding],
): string {
  return renderToStaticMarkup(
    createElement(BuildInspectorPanel, {
      tab,
      part: selectedPart,
      findings,
    }),
  );
}

describe("BuildInspector", () => {
  it("renders its empty state bilingually", () => {
    const markup = renderToStaticMarkup(
      createElement(BuildInspector, { part: null, findings: [] }),
    );

    expect(markup).toContain("尚未選擇組件");
    expect(markup).toContain("No component selected");
    expect(markup).toContain("Select a category and catalogue product first");
    expect(markup).toContain('lang="en"');
  });

  it("renders selected-part details, tabs and rule results bilingually", () => {
    const markup = renderToStaticMarkup(
      createElement(BuildInspector, { part, findings: [finding] }),
    );

    expect(markup).toContain("Selected component");
    expect(markup).toContain("6 items in stock");
    expect(markup).toContain("Details");
    expect(markup).toContain("Compatibility");
    expect(markup).toContain("3D asset");
    expect(markup).toContain("Structured specifications");
    expect(markup).toContain("Supported motherboard form factors");
    expect(markup).toContain("Specifications verified");
    expect(markup).toContain("Related rule results");
    expect(markup).toContain("Passed");
    expect(markup).toContain(finding.messageEn);
    expect(markup).not.toContain(part.id);
    expect(markup).not.toContain(part.assetId ?? "__missing_asset_id__");
  });

  it("renders compatibility guidance and evidence bilingually", () => {
    const markup = renderPanel("compatibility");
    const emptyMarkup = renderPanel("compatibility", part, []);

    expect(markup).toContain("Explainable compatibility evidence");
    expect(markup).toContain("Only verified catalogue fields are used");
    expect(markup).toContain("Motherboard form factor");
    expect(markup).toContain("Passed");
    expect(emptyMarkup).toContain("No structured compatibility rules apply");
  });

  it.each([
    ["pass", "Passed"],
    ["warning", "Warning"],
    ["error", "Error"],
    ["unknown", "Needs verification"],
  ] as const)("renders %s rule severity bilingually", (severity, english) => {
    const markup = renderPanel("details", part, [{ ...finding, severity }]);

    expect(markup).toContain(english);
    expect(markup).not.toContain(`>${severity}<`);
  });

  it.each([
    ["approved", "approved", "Approved", "Approved for manual preview"],
    ["needs_review", "reviewed", "Needs review", "Not approved for use"],
    ["draft", "draft", "Draft", "Not approved for use"],
    ["proxy", "unreviewed", "Proxy preview", "Not approved for use"],
  ] as const)(
    "renders %s asset status and %s quality bilingually",
    (assetStatus, assetQuality, statusEnglish, usageEnglish) => {
      const markup = renderPanel("asset", {
        ...part,
        assetStatus,
        assetQuality,
      });

      expect(markup).toContain("3D asset status");
      expect(markup).toContain("Visual models do not determine compatibility");
      expect(markup).toContain(statusEnglish);
      expect(markup).toContain(usageEnglish);
      expect(markup).not.toContain(part.id);
      expect(markup).not.toContain(part.assetId ?? "__missing_asset_id__");
    },
  );

  it("lets bilingual inspector copy and badges wrap in narrow layouts", async () => {
    const styles = await readFile(
      new URL("./builder.css", import.meta.url),
      "utf8",
    );

    expect(styles).toMatch(
      /\.builder-inspector-copy\s*\{[^}]*overflow-wrap:\s*anywhere;/u,
    );
    expect(styles).toMatch(
      /\.build-inspector \.status-badge\s*\{[^}]*white-space:\s*normal;/u,
    );
    expect(styles).toMatch(
      /\.build-inspector__header p\s*\{[^}]*flex-wrap:\s*wrap;/u,
    );
  });
});
