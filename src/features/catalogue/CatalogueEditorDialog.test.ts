import { readFile } from "node:fs/promises";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { catalogParts } from "../../shared/domain/mockData";
import { CatalogueEditorDialog } from "./CatalogueEditorDialog";

describe("CatalogueEditorDialog critical operations", () => {
  it("renders every product field and option bilingually", () => {
    const markup = renderToStaticMarkup(
      createElement(CatalogueEditorDialog, {
        part: catalogParts[0]!,
        onArchive: async () => {},
        onClose() {},
        onCreateAssetFromSource: async () => {},
        onSave: async () => {},
      }),
    );

    for (const expected of [
      "Version 0",
      "Edit product",
      "Category",
      "Brand / manufacturer",
      "Model",
      "Price (HKD)",
      "Stock status",
      "Stock quantity",
      "Specification verification",
      "Structured specifications (JSON)",
      "Record only known data",
      "Case",
      "In stock",
      "Unverified",
      "Human verified",
    ]) {
      expect(markup).toContain(expected);
    }
  });

  it("labels product mutations in Traditional Chinese and English", () => {
    const markup = renderToStaticMarkup(
      createElement(CatalogueEditorDialog, {
        part: catalogParts[0]!,
        onArchive: async () => {},
        onClose() {},
        onCreateAssetFromSource: async () => {},
        onSave: async () => {},
      }),
    );

    expect(markup).toContain("封存產品");
    expect(markup).toContain('<span lang="en">Archive product</span>');
    expect(markup).toContain("建立素材草稿");
    expect(markup).toContain('<span lang="en">Create asset draft</span>');
    expect(markup).toContain("取消");
    expect(markup).toContain('<span lang="en">Cancel</span>');
    expect(markup).toContain("儲存產品");
    expect(markup).toContain('<span lang="en">Save product</span>');
  });

  it("describes the default write boundary bilingually", () => {
    const markup = renderToStaticMarkup(
      createElement(CatalogueEditorDialog, {
        part: null,
        onClose() {},
        onSave: async () => {},
      }),
    );

    expect(markup).toContain("只會更新目前已驗證的工作空間");
    expect(markup).toContain("Only the currently verified workspace");
  });

  it("labels a new workspace product without exposing edit-only actions", () => {
    const markup = renderToStaticMarkup(
      createElement(CatalogueEditorDialog, {
        part: null,
        onClose() {},
        onSave: async () => {},
      }),
    );

    expect(markup).toContain("Workspace catalogue");
    expect(markup).toContain("Add product");
    expect(markup).toContain("Save product");
    expect(markup).not.toContain("Archive product");
    expect(markup).not.toContain("Create asset draft");
  });

  it("keeps viewer mode read-only and omits private identifiers", () => {
    const part = catalogParts[0]!;
    const markup = renderToStaticMarkup(
      createElement(CatalogueEditorDialog, {
        part,
        onArchive: async () => {},
        onClose() {},
        onCreateAssetFromSource: async () => {},
        onOpenAssetReview() {},
        onSave: async () => {},
        readOnly: true,
      }),
    );

    expect(markup).toContain("View product");
    expect(markup).toContain("Review asset");
    expect(markup).toContain("Cancel");
    expect(markup).toMatch(/<fieldset[^>]*disabled=""/u);
    expect(markup).not.toContain("Archive product");
    expect(markup).not.toContain("Create asset draft");
    expect(markup).not.toContain("Save product");
    expect(markup).not.toContain(part.id);
    expect(markup).not.toContain(part.assetId ?? "__missing_asset_id__");
  });

  it("wraps editor copy and actions at phone width", async () => {
    const styles = await readFile(
      new URL("./catalogue.css", import.meta.url),
      "utf8",
    );

    expect(styles).toMatch(
      /\.catalogue-editor-copy\s*\{[^}]*overflow-wrap:\s*anywhere;/u,
    );
    expect(styles).toMatch(
      /\.catalogue-dialog__actions \.button\s*\{[^}]*white-space:\s*normal;/u,
    );
    expect(styles).toMatch(
      /@media \(max-width:\s*760px\)[\s\S]*\.catalogue-editor-grid\s*\{[^}]*grid-template-columns:\s*1fr;/u,
    );
    expect(styles).toMatch(
      /@media \(max-width:\s*760px\)[\s\S]*\.catalogue-dialog__actions > div\s*\{[^}]*flex-direction:\s*column;/u,
    );
  });
});
