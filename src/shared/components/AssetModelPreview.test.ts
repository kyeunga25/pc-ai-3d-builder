import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { assetModelPreviewCopy } from "./asset-model-preview-copy";
import { AssetModelPreview } from "./AssetModelPreview";

describe("AssetModelPreview", () => {
  it("keeps canvas, loading and failure copy bilingual", () => {
    for (const copy of Object.values(assetModelPreviewCopy)) {
      expect(copy.zhHant).toMatch(/[\u3400-\u9fff]/u);
      expect(copy.english).toMatch(/[A-Za-z]/u);
    }
  });

  it("renders the initial private-model loading state bilingually", () => {
    const markup = renderToStaticMarkup(
      createElement(AssetModelPreview, {
        cameraPreset: "等角",
        url: "blob:synthetic-private-model",
      }),
    );

    expect(markup).toContain("正在解碼私人 GLB");
    expect(markup).toContain("Decoding private GLB");
    expect(markup).toContain('lang="en"');
  });
});
