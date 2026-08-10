import { z } from "zod";

import { GlbValidationError, validateGlbStructure } from "./glb-validation";
import {
  ImageStructureError,
  validateImageStructure,
} from "./image-validation";

export const assetFileKindSchema = z.enum(["source", "model"]);
export const assetSourceContentTypeSchema = z.enum([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
export const assetModelContentType = "model/gltf-binary" as const;

export const assetFileLimits = {
  source: 10 * 1024 * 1024,
  model: 25 * 1024 * 1024,
} as const;

export type AssetFileKind = z.infer<typeof assetFileKindSchema>;
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
    validateGlbStructure(bytes);
  } catch (error) {
    if (error instanceof GlbValidationError) {
      throw new AssetFileValidationError(error.message, error.code);
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
        ? "來源圖片必須小於或等於 10 MiB。"
        : "GLB 模型必須小於或等於 25 MiB。",
    );
  }

  if (kind === "source") {
    const inferredContentType = inferImageContentType(bytes);
    if (
      !inferredContentType ||
      declaredContentType.toLowerCase() !== inferredContentType
    ) {
      throw new AssetFileValidationError(
        "來源圖片容器無效、已截斷或超出安全尺寸；只接受完整 JPEG、PNG 或 WebP。 / The source image container is invalid, truncated, or exceeds safe dimensions. Upload a complete JPEG, PNG, or WebP image.",
      );
    }
    return inferredContentType;
  }

  if (
    declaredContentType.toLowerCase() !== assetModelContentType &&
    declaredContentType.toLowerCase() !== "application/octet-stream"
  ) {
    throw new AssetFileValidationError("模型必須使用 GLB 格式。");
  }
  validateGlb(bytes);
  return assetModelContentType;
}
