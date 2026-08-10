import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { catalogParts } from "../../shared/domain/mockData";
import { CatalogueEditorDialog } from "./CatalogueEditorDialog";

describe("CatalogueEditorDialog critical operations", () => {
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
});
