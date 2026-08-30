import { describe, expect, it, vi } from "vitest";

import { assetFileLimits } from "../../shared/domain/asset-files";
import { createSyntheticDraftGlb } from "../../shared/domain/synthetic-glb";
import { createSyntheticSourcePng } from "../../shared/domain/synthetic-image";
import { validateAssetUploadFile } from "./asset-upload-file";

describe("asset upload file preflight", () => {
  it.each(["", "application/octet-stream"])(
    "accepts a valid PNG with %s browser media type and a safe extension",
    async (type) => {
      const file = new File([createSyntheticSourcePng()], "front.png", {
        type,
      });

      await expect(validateAssetUploadFile("source", file)).resolves.toEqual({
        contentType: "image/png",
        file,
        kind: "source",
      });
    },
  );

  it("accepts an extensionless image only when its canonical MIME and bytes agree", async () => {
    const file = new File([createSyntheticSourcePng()], "front", {
      type: "image/png",
    });

    await expect(
      validateAssetUploadFile("source", file),
    ).resolves.toMatchObject({
      contentType: "image/png",
      kind: "source",
    });
  });

  it.each([
    ["front.jpg", "image/png", /副檔名.+MIME|extension.+media type/iu],
    ["front.gif", "image/png", /\.jpg.+\.jpeg.+\.png.+\.webp/iu],
  ])(
    "rejects a misleading source filename before upload: %s",
    async (name, type, expectedMessage) => {
      const file = new File([createSyntheticSourcePng()], name, { type });
      const bytesRead = vi.spyOn(file, "arrayBuffer");

      await expect(validateAssetUploadFile("source", file)).rejects.toThrow(
        expectedMessage,
      );
      expect(bytesRead).not.toHaveBeenCalled();
    },
  );

  it("rejects an oversized file before materializing its bytes", async () => {
    const bytesRead = vi.fn<() => Promise<ArrayBuffer>>();
    const file = {
      arrayBuffer: bytesRead,
      name: "oversized.png",
      size: assetFileLimits.source + 1,
      type: "image/png",
    } as unknown as File;

    await expect(validateAssetUploadFile("source", file)).rejects.toThrow(
      /10 MiB/iu,
    );
    expect(bytesRead).not.toHaveBeenCalled();
  });

  it("rejects spoofed image bytes even when filename and MIME agree", async () => {
    const file = new File(
      [new Uint8Array([0x89, 0x50, 0x4e, 0x47])],
      "front.png",
      {
        type: "image/png",
      },
    );

    await expect(validateAssetUploadFile("source", file)).rejects.toThrow(
      /完整、靜態.+JPEG、PNG 或 WebP|complete, static JPEG, PNG, or WebP/iu,
    );
  });

  it.each(["", "application/octet-stream", "model/gltf-binary"])(
    "normalizes a valid .glb with %s browser media type",
    async (type) => {
      const file = new File(
        [createSyntheticDraftGlb().buffer as ArrayBuffer],
        "draft.glb",
        { type },
      );

      await expect(validateAssetUploadFile("model", file)).resolves.toEqual({
        contentType: "model/gltf-binary",
        file,
        kind: "model",
      });
    },
  );

  it.each([
    ["draft.gltf", "model/gltf-binary"],
    ["draft.glb", "model/gltf+json"],
  ])(
    "rejects a non-GLB model upload before network work: %s / %s",
    async (name, type) => {
      const file = new File(
        [createSyntheticDraftGlb().buffer as ArrayBuffer],
        name,
        { type },
      );

      await expect(validateAssetUploadFile("model", file)).rejects.toThrow(
        /\.glb.+GLB|GLB.+\.glb/iu,
      );
    },
  );
});
