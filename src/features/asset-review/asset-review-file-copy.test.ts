import { describe, expect, it } from "vitest";

import {
  assetReviewFileActionCopy,
  assetReviewFileControlCopy,
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
      "Only the selected file is replaced",
    );
    expect(assetReviewFileControlCopy.replacementWarning.english).toContain(
      "other private file remains private",
    );
  });
});
