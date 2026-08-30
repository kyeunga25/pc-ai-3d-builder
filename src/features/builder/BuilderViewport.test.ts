import { readFile } from "node:fs/promises";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { catalogParts } from "../../shared/domain/mockData";
import type { CatalogPart } from "../../shared/domain/schemas";
import { BuilderViewport } from "./BuilderViewport";

const approvedPart: CatalogPart = catalogParts.find(
  (part) => part.assetStatus === "approved" && part.assetId !== null,
)!;
const selectedParts = catalogParts.filter((part) =>
  ["case", "motherboard", "cpu", "gpu", "memory"].includes(part.category),
);

function renderViewport({
  selectedCategory = "cooling",
  selectedPart = null,
  buildParts = selectedPart ? [selectedPart] : [],
  isLocalPreview = true,
}: {
  selectedCategory?: "case" | "cooling" | "summary";
  selectedPart?: CatalogPart | null;
  buildParts?: CatalogPart[];
  isLocalPreview?: boolean;
} = {}): string {
  return renderToStaticMarkup(
    createElement(BuilderViewport, {
      selectedCategory,
      camera: "等角",
      setCamera() {},
      displayMode: "著色",
      setDisplayMode() {},
      selectedPart,
      selectedParts: buildParts,
      workspaceId: "workspace-viewport-fixture",
      isLocalPreview,
    }),
  );
}

describe("BuilderViewport", () => {
  it("renders controls, fallback scene and readouts bilingually", () => {
    const markup = renderViewport();

    expect(markup).toContain("3D component preview viewport");
    expect(markup).toContain("Camera preset angles");
    expect(markup).toContain("Isometric");
    expect(markup).toContain("Front");
    expect(markup).toContain("Left");
    expect(markup).toContain("Top");
    expect(markup).toContain("Display");
    expect(markup).toContain("Shaded");
    expect(markup).toContain("Fit model to view");
    expect(markup).toContain("No approved GLB is available");
    expect(markup).toContain("Camera: Isometric");
    expect(markup).toContain("Mode: Shaded");
    expect(markup).toContain("10 mm grid");
    expect(markup).toContain("No component selected");
    expect(markup).toContain("Editing: Cooling");
    expect(markup).toContain("Static fallback preview");
    expect(markup).toContain("Visual material is not compatibility evidence");
    expect(markup).toContain("Scene v2 · +Y up · Unit: metre");
    expect(markup).toContain('lang="en"');
  });

  it("distinguishes authorized private loading from local synthetic loading", () => {
    const productionMarkup = renderViewport({
      selectedPart: approvedPart,
      isLocalPreview: false,
      selectedCategory: "case",
    });
    const localMarkup = renderViewport({
      selectedPart: approvedPart,
      selectedCategory: "case",
    });

    expect(productionMarkup).toContain(
      "Loading the private GLB through the authorized API",
    );
    expect(localMarkup).toContain("Preparing the approved local synthetic GLB");
    expect(productionMarkup).not.toContain(approvedPart.id);
    expect(productionMarkup).not.toContain(
      approvedPart.assetId ?? "__missing_asset_id__",
    );
    expect(productionMarkup).not.toContain("workspace-viewport-fixture");
  });

  it("labels local private-file fallback and bounded stock state bilingually", () => {
    const markup = renderViewport({
      selectedCategory: "case",
      selectedPart: { ...approvedPart, assetId: null },
    });

    expect(markup).toContain("Local preview does not read a private GLB");
    expect(markup).toContain("Current category component");
    expect(markup).toContain("Selectable catalogue record");
  });

  it("describes the bounded multi-model summary scene without private identifiers", () => {
    const productionMarkup = renderViewport({
      buildParts: selectedParts,
      isLocalPreview: false,
      selectedCategory: "summary",
    });
    const localMarkup = renderViewport({
      buildParts: selectedParts,
      selectedCategory: "summary",
    });

    expect(productionMarkup).toContain(
      "Loading 4 approved private GLBs in parallel through the authorized API",
    );
    expect(localMarkup).toContain("Preparing 4 approved local synthetic GLBs");
    expect(productionMarkup).toContain("Separated review layout");
    expect(productionMarkup).not.toContain("workspace-viewport-fixture");
    for (const part of selectedParts) {
      expect(productionMarkup).not.toContain(part.id);
      if (part.assetId) expect(productionMarkup).not.toContain(part.assetId);
    }
  });

  it("lets bilingual viewport status use content height and wrap", async () => {
    const styles = await readFile(
      new URL("./builder.css", import.meta.url),
      "utf8",
    );

    expect(styles).toContain("grid-template-rows: 62px minmax(0, 1fr) auto;");
    expect(styles).toMatch(
      /\.builder-viewport__footer\s*\{[^}]*flex-wrap:\s*wrap;/u,
    );
    expect(styles).toMatch(
      /\.builder-viewport-copy\s*\{[^}]*overflow-wrap:\s*anywhere;/u,
    );
    expect(styles).toMatch(
      /@media \(max-width: 520px\)[\s\S]*?\.builder-private-model figcaption\s*\{[^}]*border:\s*0;[^}]*padding:\s*0;[^}]*clip-path:\s*inset\(50%\);/u,
    );
  });
});
