import { z } from "zod";

import {
  GlbValidationError,
  rigStageGlbSafetyPolicy,
  validateGlbSafety,
} from "./glb-validation";
import {
  ImageStructureError,
  validateImageStructure,
} from "./image-validation";

export const assetFileKindSchema = z.enum(["source", "model"]);
export const assetSourceViews = [
  "front",
  "back",
  "left",
  "three-quarter",
] as const;
export const assetSourceViewSchema = z.enum(assetSourceViews);
export const assetSourceContentTypeSchema = z.enum([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
export const assetModelContentType = "model/gltf-binary" as const;

export const assetFileLimits = {
  source: 10 * 1024 * 1024,
  model: rigStageGlbSafetyPolicy.maxBytes,
} as const;

export type AssetFileKind = z.infer<typeof assetFileKindSchema>;
export type AssetSourceView = z.infer<typeof assetSourceViewSchema>;
export type AssetSourceContentType = z.infer<
  typeof assetSourceContentTypeSchema
>;

export class AssetFileValidationError extends Error {
  constructor(
    message: string,
    readonly code = "ASSET_FILE_INVALID",
  ) {
    super(message);
    this.name = "AssetFileValidationError";
  }
}

function inferImageContentType(
  bytes: Uint8Array,
): AssetSourceContentType | null {
  try {
    return validateImageStructure(bytes);
  } catch (error) {
    if (error instanceof ImageStructureError) {
      return null;
    }
    throw error;
  }
}

function validateGlb(bytes: Uint8Array): void {
  try {
    validateGlbSafety(bytes, rigStageGlbSafetyPolicy);
  } catch (error) {
    if (error instanceof GlbValidationError) {
      const publicMessage: Record<GlbValidationError["code"], string> = {
        GLB_DIMENSIONS_EXCEEDED:
          "GLB 幾何尺寸超出安全限制。 / The GLB geometry exceeds the safe dimension limit.",
        GLB_EXTERNAL_URI:
          "GLB 必須自包含，不可引用外部檔案。 / The GLB must be self-contained and cannot reference external files.",
        GLB_HEADER_INVALID:
          "GLB 檔案格式無效。 / The GLB file format is invalid.",
        GLB_LENGTH_MISMATCH:
          "GLB 檔案不完整或長度資料不一致。 / The GLB is incomplete or its length metadata does not match.",
        GLB_POLYGON_LIMIT_EXCEEDED:
          "GLB 三角形數量超出安全限制。 / The GLB triangle count exceeds the safe limit.",
        GLB_STRUCTURE_INVALID:
          "GLB 結構無效或不受支援。 / The GLB structure is invalid or unsupported.",
        GLB_TEXTURE_LIMIT_EXCEEDED:
          "GLB 貼圖數量或大小超出安全限制。 / The GLB texture count or size exceeds the safe limit.",
      };
      throw new AssetFileValidationError(publicMessage[error.code], error.code);
    }
    throw error;
  }
}

export function validateAssetFileBytes(
  kind: "source",
  declaredContentType: string,
  bytes: Uint8Array,
): AssetSourceContentType;
export function validateAssetFileBytes(
  kind: "model",
  declaredContentType: string,
  bytes: Uint8Array,
): typeof assetModelContentType;
export function validateAssetFileBytes(
  kind: AssetFileKind,
  declaredContentType: string,
  bytes: Uint8Array,
): AssetSourceContentType | typeof assetModelContentType;
export function validateAssetFileBytes(
  kind: AssetFileKind,
  declaredContentType: string,
  bytes: Uint8Array,
): AssetSourceContentType | typeof assetModelContentType {
  if (bytes.byteLength === 0 || bytes.byteLength > assetFileLimits[kind]) {
    throw new AssetFileValidationError(
      kind === "source"
        ? "來源圖片必須小於或等於 10 MiB。 / The source image must be 10 MiB or smaller."
        : "GLB 模型必須小於或等於 25 MiB。 / The GLB model must be 25 MiB or smaller.",
    );
  }

  if (kind === "source") {
    const inferredContentType = inferImageContentType(bytes);
    if (
      !inferredContentType ||
      declaredContentType.toLowerCase() !== inferredContentType
    ) {
      throw new AssetFileValidationError(
        "來源圖片必須是完整、靜態且符合安全尺寸的 JPEG、PNG 或 WebP。 / The source image must be a complete, static JPEG, PNG, or WebP within the safe dimensions.",
      );
    }
    return inferredContentType;
  }

  if (
    declaredContentType.toLowerCase() !== assetModelContentType &&
    declaredContentType.toLowerCase() !== "application/octet-stream"
  ) {
    throw new AssetFileValidationError(
      "模型必須使用 GLB 格式。 / The model must use the GLB format.",
    );
  }
  validateGlb(bytes);
  return assetModelContentType;
}
