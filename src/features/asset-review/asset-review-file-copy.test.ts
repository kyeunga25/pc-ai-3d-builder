import { describe, expect, it } from "vitest";

import {
  assetReviewFileActionCopy,
  assetReviewFileControlCopy,
  assetReviewFileRemoveActionCopy,
  nextAssetReviewFileRemoveIntent,
} from "./asset-review-file-copy";

describe("Asset Review private file copy", () => {
  it("keeps every static file-control label bilingual", () => {
    for (const copy of Object.values(assetReviewFileControlCopy)) {
      expect(copy.zhHant).toMatch(/[\u3400-\u9fff]/u);
      expect(copy.english).toMatch(/[A-Za-z]/u);
    }
  });

  it.each([
    ["source", false, false, "上載圖片", "Upload image"],
    ["source", true, false, "取代圖片", "Replace image"],
    ["source", false, true, "上載中…", "Uploading…"],
    ["model", false, false, "上載 GLB", "Upload GLB"],
    ["model", true, false, "取代 GLB", "Replace GLB"],
    ["model", false, true, "上載中…", "Uploading…"],
  ] as const)(
    "formats %s exists=%s uploading=%s bilingually",
    (kind, exists, uploading, zhHant, english) => {
      expect(assetReviewFileActionCopy(kind, exists, uploading)).toEqual({
        english,
        zhHant,
      });
    },
  );

  it("warns that replacement resets evidence and limits replacement scope", () => {
    expect(assetReviewFileControlCopy.replacementWarning.zhHant).toContain(
      "重設核准清單",
    );
    expect(assetReviewFileControlCopy.replacementWarning.english).toContain(
      "resets the approval checklist",
    );
    expect(assetReviewFileControlCopy.replacementWarning.english).toContain(
      "affects only the selected view or GLB",
    );
    expect(assetReviewFileControlCopy.replacementWarning.english).toContain(
      "all other private files remain private",
    );
  });

  it.each([
    ["source", false, false, "移除圖片", "Remove image"],
    ["source", true, false, "確認移除圖片", "Confirm image removal"],
    ["source", false, true, "移除圖片中…", "Removing image…"],
    ["model", false, false, "移除 GLB", "Remove GLB"],
    ["model", true, false, "確認移除 GLB", "Confirm GLB removal"],
    ["model", false, true, "移除 GLB 中…", "Removing GLB…"],
  ] as const)(
    "formats %s removal armed=%s removing=%s bilingually",
    (kind, armed, removing, zhHant, english) => {
      expect(assetReviewFileRemoveActionCopy(kind, armed, removing)).toEqual({
        english,
        zhHant,
      });
    },
  );

  it("requires a second request for the same exact file-removal key", () => {
    expect(
      nextAssetReviewFileRemoveIntent(null, "asset:1:source:back"),
    ).toEqual({
      nextArmedKey: "asset:1:source:back",
      shouldSubmit: false,
    });
    expect(
      nextAssetReviewFileRemoveIntent(
        "asset:1:source:back",
        "asset:1:source:back",
      ),
    ).toEqual({ nextArmedKey: null, shouldSubmit: true });
    expect(
      nextAssetReviewFileRemoveIntent(
        "asset:1:source:back",
        "asset:1:source:left",
      ),
    ).toEqual({
      nextArmedKey: "asset:1:source:left",
      shouldSubmit: false,
    });
  });
});
