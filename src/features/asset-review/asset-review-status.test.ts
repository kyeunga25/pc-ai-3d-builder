import { describe, expect, it } from "vitest";

import { AssetFileValidationError } from "../../shared/domain/asset-files";
import { AssetReviewApiError } from "./asset-review-api";
import {
  assetReviewErrorNotice,
  assetReviewNotice,
  assetReviewSavedNotice,
  assetReviewSavingNotice,
  assetReviewStatusCopy,
} from "./asset-review-status";

const bilingualPattern = /[\u3400-\u9fff].*[A-Za-z]/u;

describe("Asset Review status copy", () => {
  it("creates typed bilingual notices", () => {
    expect(assetReviewNotice("正在檢查。", "Checking.", "info")).toEqual({
      english: "Checking.",
      tone: "info",
      zhHant: "正在檢查。",
    });

    for (const notice of Object.values(assetReviewStatusCopy)) {
      expect(`${notice.zhHant} ${notice.english}`).toMatch(bilingualPattern);
      expect(["error", "info", "success", "warning"]).toContain(notice.tone);
    }
  });

  it.each([
    "approve",
    "generation",
    "model-upload",
    "reject",
    "save",
    "source-upload",
  ] as const)(
    "replaces a monolingual %s failure with an uncertainty-safe fallback",
    (operation) => {
      const notice = assetReviewErrorNotice(
        new TypeError("Failed to fetch"),
        operation,
      );

      expect(notice.tone).toBe("error");
      expect(notice.zhHant).toContain("無法確認");
      expect(notice.english).toContain("Unable to confirm");
      expect(notice.english.toLowerCase()).toContain("reload");
      expect(notice.english).not.toContain("Failed to fetch");
      expect(notice.english).not.toContain("Saved data was not changed");
    },
  );

  it("retains bounded bilingual API and file-validation messages", () => {
    const apiMessage =
      "素材版本已改變，請重新載入。 / The asset version changed. Reload before retrying.";
    const fileMessage =
      "來源圖片格式不受支援。 / The source image format is unsupported.";

    expect(
      assetReviewErrorNotice(
        new AssetReviewApiError(409, "ASSET_VERSION_CONFLICT", apiMessage),
        "approve",
      ),
    ).toEqual({
      english: "The asset version changed. Reload before retrying.",
      tone: "error",
      zhHant: "素材版本已改變，請重新載入。",
    });
    expect(
      assetReviewErrorNotice(
        new AssetFileValidationError(fileMessage),
        "source-upload",
      ),
    ).toEqual({
      english: "The source image format is unsupported.",
      tone: "error",
      zhHant: "來源圖片格式不受支援。",
    });
  });

  it.each([
    ["approve", "正在核准素材", "Approving the asset"],
    ["reject", "正在拒絕素材", "Rejecting the asset"],
    ["save_draft", "正在儲存審核草稿", "Saving the review draft"],
  ] as const)(
    "distinguishes %s progress and successful completion",
    (action, zhHant, english) => {
      const progress = assetReviewSavingNotice(action);
      const completed = assetReviewSavedNotice(action, false);

      expect(progress).toMatchObject({ tone: "info" });
      expect(progress.zhHant).toContain(zhHant);
      expect(progress.english).toContain(english);
      expect(completed.tone).toBe("success");
    },
  );

  it("rejects malformed bilingual-looking exception text", () => {
    expect(
      assetReviewErrorNotice(
        new AssetReviewApiError(500, "FAILED", "錯誤。 / "),
        "reject",
      ),
    ).toEqual(assetReviewStatusCopy.rejectFailed);
  });
});
