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
  builderViewportLayoutBoundaryCopy,
  builderViewportModelCaptionCopy,
  builderViewportPlaceholderCopy,
  builderViewportSceneDetailsCopy,
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
        candidateCount: 1,
        hasApprovedAsset: true,
        isLocalPreview: true,
        isLocalSyntheticModel: true,
        isSummary: false,
        modelState: "loading",
      }).english,
    ).toBe("Preparing the approved local synthetic GLB…");
    expect(
      builderViewportPlaceholderCopy({
        candidateCount: 1,
        hasApprovedAsset: true,
        isLocalPreview: false,
        isLocalSyntheticModel: false,
        isSummary: false,
        modelState: "loading",
      }).english,
    ).toBe("Loading the private GLB through the authorized API…");
    expect(
      builderViewportPlaceholderCopy({
        candidateCount: 1,
        hasApprovedAsset: true,
        isLocalPreview: false,
        isLocalSyntheticModel: false,
        isSummary: false,
        modelState: "error",
      }).english,
    ).toContain("Unable to load the approved private GLB");
    expect(
      builderViewportPlaceholderCopy({
        candidateCount: 0,
        hasApprovedAsset: true,
        isLocalPreview: true,
        isLocalSyntheticModel: false,
        isSummary: false,
        modelState: "none",
      }).english,
    ).toContain("Local preview does not read a private GLB");
    expect(
      builderViewportPlaceholderCopy({
        candidateCount: 0,
        hasApprovedAsset: false,
        isLocalPreview: false,
        isLocalSyntheticModel: false,
        isSummary: false,
        modelState: "none",
      }).english,
    ).toContain("No approved GLB is available");
  });

  it("describes private and local multi-model review scenes without mechanical claims", () => {
    expect(
      builderViewportPlaceholderCopy({
        candidateCount: 4,
        hasApprovedAsset: false,
        isLocalPreview: false,
        isLocalSyntheticModel: false,
        isSummary: true,
        modelState: "loading",
      }).english,
    ).toBe(
      "Loading 4 approved private GLBs in parallel through the authorized API…",
    );
    expect(
      builderViewportPlaceholderCopy({
        candidateCount: 4,
        hasApprovedAsset: false,
        isLocalPreview: true,
        isLocalSyntheticModel: true,
        isSummary: true,
        modelState: "loading",
      }).english,
    ).toBe("Preparing 4 approved local synthetic GLBs…");
    expect(builderViewportLayoutBoundaryCopy(true).english).toContain(
      "Separated review layout",
    );
    expect(builderViewportSceneDetailsCopy(true).english).toContain(
      "review layout",
    );
    expect(
      builderViewportModelCaptionCopy({
        candidateCount: 4,
        failedCount: 0,
        isLocalSyntheticModel: false,
        isSummary: true,
        isLoading: true,
        loadedCount: 0,
      }).english,
    ).toBe("Decoding 4 approved GLBs…");
    expect(
      builderViewportModelCaptionCopy({
        candidateCount: 4,
        failedCount: 2,
        isLocalSyntheticModel: false,
        isSummary: true,
        isLoading: false,
        loadedCount: 2,
      }).english,
    ).toContain("Showing 2 of 4 approved private GLBs");
    expect(
      builderViewportFooterPreviewCopy({
        hasModel: true,
        isLocalSyntheticModel: false,
        isSummary: true,
        isLoading: true,
        loadedCount: 0,
      }).english,
    ).toBe("Decoding approved component previews");
  });

  it("formats camera, mode, model and footer states without raw enum copy", () => {
    expect(builderViewportCameraReadoutCopy("等角").english).toBe(
      "Camera: Isometric",
    );
    expect(builderViewportDisplayReadoutCopy("線框").english).toBe(
      "Mode: Wireframe",
    );
    expect(
      builderViewportModelCaptionCopy({
        candidateCount: 1,
        failedCount: 0,
        isLocalSyntheticModel: true,
        isSummary: false,
        isLoading: false,
        loadedCount: 1,
      }).english,
    ).toContain("Approved local synthetic GLB");
    expect(
      builderViewportModelCaptionCopy({
        candidateCount: 1,
        failedCount: 0,
        isLocalSyntheticModel: false,
        isSummary: false,
        isLoading: false,
        loadedCount: 1,
      }).english,
    ).toContain("Approved private GLB");
    expect(
      builderViewportFooterPreviewCopy({
        hasModel: false,
        isLocalSyntheticModel: false,
        isSummary: false,
        isLoading: false,
        loadedCount: 0,
      }).english,
    ).toBe("Static fallback preview");
  });
});
