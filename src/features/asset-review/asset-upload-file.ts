import {
  AssetFileValidationError,
  assetFileLimits,
  assetModelContentType,
  assetSourceContentTypeSchema,
  type AssetSourceContentType,
  validateAssetFileBytes,
} from "../../shared/domain/asset-files";

export type ValidatedSourceUpload = {
  contentType: AssetSourceContentType;
  file: File;
  kind: "source";
};

export type ValidatedModelUpload = {
  contentType: typeof assetModelContentType;
  file: File;
  kind: "model";
};

export type ValidatedAssetUpload = ValidatedModelUpload | ValidatedSourceUpload;

const sourceExtensionTypes = {
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const satisfies Record<string, AssetSourceContentType>;

function fileExtension(fileName: string): string | null {
  const match = /\.([^.]+)$/u.exec(fileName.trim().toLowerCase());
  return match?.[1] ?? null;
}

function assertUploadSize(kind: ValidatedAssetUpload["kind"], file: File) {
  if (file.size > 0 && file.size <= assetFileLimits[kind]) return;
  throw new AssetFileValidationError(
    kind === "source"
      ? "來源圖片必須是非空白檔案，並小於或等於 10 MiB。 / The source image must be non-empty and 10 MiB or smaller."
      : "GLB 模型必須是非空白檔案，並小於或等於 25 MiB。 / The GLB model must be non-empty and 25 MiB or smaller.",
  );
}

function sourceTypeFromMetadata(file: File): AssetSourceContentType {
  const extension = fileExtension(file.name);
  const extensionType = extension
    ? sourceExtensionTypes[extension as keyof typeof sourceExtensionTypes]
    : undefined;
  if (extension && !extensionType) {
    throw new AssetFileValidationError(
      "來源圖片檔名必須使用 .jpg、.jpeg、.png 或 .webp。 / The source-image filename must use .jpg, .jpeg, .png or .webp.",
    );
  }

  const browserType = file.type.trim().toLowerCase();
  const declared = assetSourceContentTypeSchema.safeParse(browserType);
  const generic =
    browserType === "" || browserType === "application/octet-stream";
  if (!declared.success && !generic) {
    throw new AssetFileValidationError(
      "來源圖片 MIME 類型必須是 image/jpeg、image/png 或 image/webp。 / The source-image media type must be image/jpeg, image/png or image/webp.",
    );
  }
  if (extensionType && declared.success && extensionType !== declared.data) {
    throw new AssetFileValidationError(
      "來源圖片的副檔名與 MIME 類型不一致。 / The source-image extension does not match its media type.",
    );
  }

  const contentType = declared.success ? declared.data : extensionType;
  if (!contentType) {
    throw new AssetFileValidationError(
      "無法從來源圖片檔名或 MIME 類型確認格式；請使用 .jpg、.jpeg、.png 或 .webp。 / The source-image format cannot be confirmed from its filename or media type; use .jpg, .jpeg, .png or .webp.",
    );
  }
  return contentType;
}

function assertModelMetadata(file: File): void {
  const extension = fileExtension(file.name);
  const browserType = file.type.trim().toLowerCase();
  const validBrowserType =
    browserType === "" ||
    browserType === "application/octet-stream" ||
    browserType === assetModelContentType;
  if (
    (extension !== null && extension !== "glb") ||
    !validBrowserType ||
    (extension === null && browserType !== assetModelContentType)
  ) {
    throw new AssetFileValidationError(
      "模型檔名必須使用 .glb，並包含完整 GLB 內容。 / The model filename must use .glb and contain complete GLB content.",
    );
  }
}

export async function validateAssetUploadFile(
  kind: "source",
  file: File,
): Promise<ValidatedSourceUpload>;
export async function validateAssetUploadFile(
  kind: "model",
  file: File,
): Promise<ValidatedModelUpload>;
export async function validateAssetUploadFile(
  kind: ValidatedAssetUpload["kind"],
  file: File,
): Promise<ValidatedAssetUpload>;
export async function validateAssetUploadFile(
  kind: ValidatedAssetUpload["kind"],
  file: File,
): Promise<ValidatedAssetUpload> {
  assertUploadSize(kind, file);

  if (kind === "source") {
    const declaredContentType = sourceTypeFromMetadata(file);
    const contentType = validateAssetFileBytes(
      kind,
      declaredContentType,
      new Uint8Array(await file.arrayBuffer()),
    );
    return { contentType, file, kind };
  }

  assertModelMetadata(file);
  validateAssetFileBytes(
    kind,
    assetModelContentType,
    new Uint8Array(await file.arrayBuffer()),
  );
  return { contentType: assetModelContentType, file, kind };
}
