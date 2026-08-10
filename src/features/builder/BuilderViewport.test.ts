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

function renderViewport({
  selectedPart = null,
  isLocalPreview = true,
  localApprovedAssetId = null,
}: {
  selectedPart?: CatalogPart | null;
  isLocalPreview?: boolean;
  localApprovedAssetId?: string | null;
} = {}): string {
  return renderToStaticMarkup(
    createElement(BuilderViewport, {
      selectedCategory: "cooling",
      camera: "等角",
      setCamera() {},
      displayMode: "著色",
      setDisplayMode() {},
      selectedPart,
      workspaceId: "workspace-viewport-fixture",
      isLocalPreview,
      localApprovedAssetId,
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
    expect(markup).toContain("Scene v1 · +Y up · Unit: metre");
    expect(markup).toContain('lang="en"');
  });

  it("distinguishes authorized private loading from local synthetic loading", () => {
    const productionMarkup = renderViewport({
      selectedPart: approvedPart,
      isLocalPreview: false,
    });
    const localMarkup = renderViewport({
      selectedPart: approvedPart,
      localApprovedAssetId: approvedPart.assetId,
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
    const markup = renderViewport({ selectedPart: approvedPart });

    expect(markup).toContain("Local preview does not read a private GLB");
    expect(markup).toContain("Current category component");
    expect(markup).toContain("Selectable catalogue record");
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
  });
});
