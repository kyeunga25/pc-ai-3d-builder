import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AssetReviewStatusView } from "./AssetReviewStatusView";
import { assetReviewStatusCopy } from "./asset-review-status";

describe("AssetReviewStatusView", () => {
  it("announces failures as alerts with an error icon", () => {
    const markup = renderToStaticMarkup(
      createElement(AssetReviewStatusView, {
        notice: assetReviewStatusCopy.approveFailed,
        zhHantSuffix: " · 指定素材",
        englishSuffix: " · Selected asset",
      }),
    );

    expect(markup).toContain('class="asset-review-status is-error"');
    expect(markup).toContain('role="alert"');
    expect(markup).toContain("lucide-circle-alert");
    expect(markup).not.toContain("lucide-circle-check");
    expect(markup).toContain("Selected asset");
  });

  it("announces warnings politely without presenting success", () => {
    const markup = renderToStaticMarkup(
      createElement(AssetReviewStatusView, {
        notice: assetReviewStatusCopy.checklistDirty,
        zhHantSuffix: "",
        englishSuffix: "",
      }),
    );

    expect(markup).toContain('class="asset-review-status is-warning"');
    expect(markup).toContain('role="status"');
    expect(markup).toContain("lucide-triangle-alert");
    expect(markup).not.toContain("lucide-circle-check");
  });
});
