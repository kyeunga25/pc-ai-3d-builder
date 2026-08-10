import { readFile } from "node:fs/promises";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CompatibilityFinding } from "../../shared/domain/builds";
import { catalogParts } from "../../shared/domain/mockData";
import type {
  CatalogPart,
  ComponentCategory,
} from "../../shared/domain/schemas";
import { ComponentRail } from "./ComponentRail";

const gpuParts = catalogParts.filter((part) => part.category === "gpu");
const selectedGpu: CatalogPart = gpuParts[0]!;

function renderRail({
  selected = "gpu",
  catalogue = gpuParts,
  selectedParts = [selectedGpu],
  findings = [],
  canWrite = true,
}: {
  selected?: ComponentCategory | "summary";
  catalogue?: CatalogPart[];
  selectedParts?: CatalogPart[];
  findings?: CompatibilityFinding[];
  canWrite?: boolean;
} = {}): string {
  return renderToStaticMarkup(
    createElement(ComponentRail, {
      selected,
      catalogueParts: catalogue,
      selectedParts,
      findings,
      canWrite,
      onSelect() {},
      onChoosePart() {},
    }),
  );
}

describe("ComponentRail", () => {
  it("renders navigation, state, candidates and persistence guidance bilingually", () => {
    const markup = renderRail();

    expect(markup).toContain("Build components");
    expect(markup).toContain("1 of 9 selected");
    expect(markup).toContain("Case");
    expect(markup).toContain("Motherboard");
    expect(markup).toContain("Cooling");
    expect(markup).toContain("Summary");
    expect(markup).toContain("Selected");
    expect(markup).toContain("Not selected");
    expect(markup).toContain("GPU options");
    expect(markup).toContain(`${gpuParts.length} options`);
    expect(markup).toContain("items in stock");
    expect(markup).toContain("Currently out of stock");
    expect(markup).toContain(
      "Only catalogue records from the current workspace",
    );
    expect(markup).toContain("Save to write the selection to D1");
    expect(markup).toContain("Selected component");
    expect(markup).toContain('lang="en"');
  });

  it("renders summary and empty-category guidance bilingually", () => {
    const summaryMarkup = renderRail({ selected: "summary" });
    const emptyMarkup = renderRail({
      selected: "cooling",
      catalogue: [],
      selectedParts: [],
    });

    expect(summaryMarkup).toContain("Build summary");
    expect(summaryMarkup).toContain("Export ready");
    expect(summaryMarkup).toContain(
      "Compatibility is never inferred from 3D appearance",
    );
    expect(summaryMarkup).toContain("1 category selected");
    expect(emptyMarkup).toContain("Cooling options");
    expect(emptyMarkup).toContain(
      "No selectable catalogue products are available in this category",
    );
    expect(emptyMarkup).toContain("Choose from the catalogue candidates above");
  });

  it("keeps viewer candidates disabled and private identifiers out of markup", () => {
    const markup = renderRail({ canWrite: false });

    expect(markup).toContain('disabled=""');
    for (const part of gpuParts) {
      expect(markup).not.toContain(part.id);
      expect(markup).not.toContain(part.assetId ?? "__missing_asset_id__");
    }
  });

  it("lets bilingual rail copy wrap while compact steps remain accessible", async () => {
    const styles = await readFile(
      new URL("./builder.css", import.meta.url),
      "utf8",
    );

    expect(styles).toMatch(
      /\.component-rail-copy\s*\{[^}]*overflow-wrap:\s*anywhere;/u,
    );
    expect(styles).toContain("grid-template-rows: auto minmax(0, 1fr) auto;");
    expect(styles).toMatch(
      /\.component-rail__selection strong\s*\{[^}]*white-space:\s*normal;/u,
    );
    expect(styles).not.toContain(".candidate-part span {");
    expect(styles).toContain(".candidate-part > span:last-child > span {");
  });
});
