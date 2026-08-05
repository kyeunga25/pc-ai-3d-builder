import { z } from "zod";

import { GlbValidationError, validateGlbStructure } from "./glb-validation";

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

function bytesEqual(
  bytes: Uint8Array,
  offset: number,
  expected: readonly number[],
): boolean {
  return expected.every((value, index) => bytes[offset + index] === value);
}

function inferImageContentType(
  bytes: Uint8Array,
): AssetSourceContentType | null {
  if (
    bytes.length >= 8 &&
    bytesEqual(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  ) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytesEqual(bytes, 0, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 12 &&
    bytesEqual(bytes, 0, [0x52, 0x49, 0x46, 0x46]) &&
    bytesEqual(bytes, 8, [0x57, 0x45, 0x42, 0x50])
  ) {
    return "image/webp";
  }
  return null;
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
        "來源圖片的格式或檔頭無效；只接受 JPEG、PNG 或 WebP。",
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
