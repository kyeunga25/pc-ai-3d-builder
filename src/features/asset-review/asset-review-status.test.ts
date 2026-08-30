import { describe, expect, it } from "vitest";

import { AssetFileValidationError } from "../../shared/domain/asset-files";
import { AssetReviewApiError } from "./asset-review-api";
import {
  assetReviewErrorNotice,
  assetReviewFileRemovedNotice,
  assetReviewNotice,
  assetReviewRejectActionLabel,
  assetReviewSavedNotice,
  assetReviewSavingNotice,
  assetReviewStatusCopy,
  nextAssetReviewRejectIntent,
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
    "generation-cancel",
    "model-remove",
    "model-upload",
    "reject",
    "save",
    "source-remove",
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

  it("keeps reject confirmation separate from the submitting state", () => {
    expect(assetReviewRejectActionLabel(false, false)).toEqual({
      english: "Reject",
      zhHant: "拒絕",
    });
    expect(assetReviewRejectActionLabel(true, false)).toEqual({
      english: "Confirm rejection",
      zhHant: "確認拒絕",
    });
    expect(assetReviewRejectActionLabel(true, true)).toEqual({
      english: "Rejecting…",
      zhHant: "拒絕中…",
    });
    expect(assetReviewStatusCopy.confirmReject).toMatchObject({
      tone: "warning",
    });
    expect(assetReviewStatusCopy.confirmReject.zhHant).toContain(
      "不會刪除私人檔案",
    );
    expect(assetReviewStatusCopy.confirmReject.english).toContain(
      "reserved credit",
    );
  });

  it("submits rejection only after two requests for the same asset version", () => {
    const firstRequest = nextAssetReviewRejectIntent(
      null,
      "workspace-a:asset-a:3",
    );
    expect(firstRequest).toEqual({
      nextArmedKey: "workspace-a:asset-a:3",
      shouldSubmit: false,
    });

    expect(
      nextAssetReviewRejectIntent(
        firstRequest.nextArmedKey,
        "workspace-a:asset-a:3",
      ),
    ).toEqual({ nextArmedKey: null, shouldSubmit: true });
    expect(
      nextAssetReviewRejectIntent(
        firstRequest.nextArmedKey,
        "workspace-a:asset-a:4",
      ),
    ).toEqual({
      nextArmedKey: "workspace-a:asset-a:4",
      shouldSubmit: false,
    });
  });

  it("describes exact private-file removal confirmation and credit release", () => {
    expect(assetReviewStatusCopy.confirmSourceRemoval).toMatchObject({
      tone: "warning",
    });
    expect(assetReviewStatusCopy.confirmSourceRemoval.zhHant).toContain(
      "所選私人來源視角",
    );
    expect(assetReviewStatusCopy.confirmSourceRemoval.english).toContain(
      "Other private files are unchanged",
    );
    expect(assetReviewStatusCopy.confirmModelRemoval.english).toContain(
      "All source images are unchanged",
    );
    expect(assetReviewStatusCopy.confirmationCanceled).toMatchObject({
      tone: "info",
    });
    expect(assetReviewStatusCopy.confirmationCanceled.english).toContain(
      "No file-removal, rejection or queued-job cancellation request was submitted",
    );

    const released = assetReviewFileRemovedNotice("source", true);
    expect(released).toMatchObject({ tone: "success" });
    expect(released.zhHant).toContain("已釋放保留 credit");
    expect(released.english).toContain("Reserved credit was released");

    const removedModel = assetReviewFileRemovedNotice("model", false);
    expect(removedModel.zhHant).toContain("私人 GLB 已移除");
    expect(removedModel.english).not.toContain("credit");
  });

  it("describes queued-only generation cancellation and exact credit outcome", () => {
    expect(assetReviewStatusCopy.confirmGenerationCancel).toMatchObject({
      tone: "warning",
    });
    expect(assetReviewStatusCopy.confirmGenerationCancel.zhHant).toContain(
      "仍在排隊",
    );
    expect(assetReviewStatusCopy.confirmGenerationCancel.english).toContain(
      "If Workflow already started",
    );
    expect(assetReviewStatusCopy.generationCancelled).toMatchObject({
      tone: "success",
    });
    expect(assetReviewStatusCopy.generationCancelled.english).toContain(
      "reserved credit was released",
    );
    expect(assetReviewStatusCopy.generationCancelFailed.english).toContain(
      "Do not assume the credit was released",
    );
  });

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
