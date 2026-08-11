import { describe, expect, it } from "vitest";

import {
  builderCameraPresets,
  builderViewportCameraCopy,
  builderViewportCameraReadoutCopy,
  builderViewportCategoryCopy,
  builderViewportCopy,
  builderViewportDisplayModeCopy,
  builderViewportDisplayReadoutCopy,
  builderViewportFooterPreviewCopy,
  builderViewportModelCaptionCopy,
  builderViewportPlaceholderCopy,
  builderViewportStockCopy,
} from "./builder-viewport-copy";

describe("Builder viewport copy", () => {
  it("covers every camera, display mode, category and stock state exactly once", () => {
    expect(builderCameraPresets).toEqual(["等角", "正面", "左側", "頂部"]);
    expect(Object.keys(builderViewportCameraCopy)).toEqual(
      builderCameraPresets,
    );
    expect(Object.keys(builderViewportDisplayModeCopy)).toEqual([
      "著色",
      "線框",
      "靜態預覽",
    ]);
    expect(Object.keys(builderViewportCategoryCopy)).toEqual([
      "case",
      "motherboard",
      "cpu",
      "gpu",
      "memory",
      "cooling",
      "storage",
      "psu",
      "fans",
      "summary",
    ]);
    expect(Object.keys(builderViewportStockCopy)).toEqual([
      "in_stock",
      "low_stock",
      "out_of_stock",
      "unknown",
    ]);
  });

  it("keeps all static and enumerated viewport copy bilingual", () => {
    const copies = [
      ...Object.values(builderViewportCopy),
      ...Object.values(builderViewportCameraCopy),
      ...Object.values(builderViewportDisplayModeCopy),
      ...Object.values(builderViewportCategoryCopy),
      ...Object.values(builderViewportStockCopy),
    ];

    for (const copy of copies) {
      expect(copy.zhHant).toMatch(/[\u3400-\u9fff]/u);
      expect(copy.english).toMatch(/[A-Za-z]/u);
    }
  });

  it("distinguishes every private-model loading and fallback boundary", () => {
    expect(
      builderViewportPlaceholderCopy({
        hasApprovedAsset: true,
        isLocalPreview: true,
        isLocalSyntheticModel: true,
        modelState: "loading",
      }).english,
    ).toBe("Preparing the approved local synthetic GLB…");
    expect(
      builderViewportPlaceholderCopy({
        hasApprovedAsset: true,
        isLocalPreview: false,
        isLocalSyntheticModel: false,
        modelState: "loading",
      }).english,
    ).toBe("Loading the private GLB through the authorized API…");
    expect(
      builderViewportPlaceholderCopy({
        hasApprovedAsset: true,
        isLocalPreview: false,
        isLocalSyntheticModel: false,
        modelState: "error",
      }).english,
    ).toContain("Unable to load the approved private GLB");
    expect(
      builderViewportPlaceholderCopy({
        hasApprovedAsset: true,
        isLocalPreview: true,
        isLocalSyntheticModel: false,
        modelState: "none",
      }).english,
    ).toContain("Local preview does not read a private GLB");
    expect(
      builderViewportPlaceholderCopy({
        hasApprovedAsset: false,
        isLocalPreview: false,
        isLocalSyntheticModel: false,
        modelState: "none",
      }).english,
    ).toContain("No approved GLB is available");
  });

  it("formats camera, mode, model and footer states without raw enum copy", () => {
    expect(builderViewportCameraReadoutCopy("等角").english).toBe(
      "Camera: Isometric",
    );
    expect(builderViewportDisplayReadoutCopy("線框").english).toBe(
      "Mode: Wireframe",
    );
    expect(builderViewportModelCaptionCopy(true).english).toContain(
      "Approved local synthetic GLB",
    );
    expect(builderViewportModelCaptionCopy(false).english).toContain(
      "Approved private GLB",
    );
    expect(builderViewportFooterPreviewCopy(false, false).english).toBe(
      "Static fallback preview",
    );
  });
});
