import {
  CatalogueImportError,
  catalogueImportFormatForFile,
  catalogueImportMaxBytes,
  parseCatalogueImportFile,
  type CatalogueImportFormat,
} from "../../shared/domain/catalogue-import";
import type { CataloguePartInput } from "../../shared/domain/schemas";

export type ValidatedCatalogueImportFile = {
  format: CatalogueImportFormat;
  inputs: CataloguePartInput[];
};

async function decodeCatalogueImportFile(file: File): Promise<string> {
  try {
    return new TextDecoder("utf-8", {
      fatal: true,
      ignoreBOM: false,
    }).decode(await file.arrayBuffer());
  } catch {
    throw new CatalogueImportError(
      "validation",
      "CSV／TSV 檔案必須使用有效 UTF-8 文字。 / The CSV or TSV file must contain valid UTF-8 text.",
    );
  }
}

export async function validateCatalogueImportFile(
  file: File,
): Promise<ValidatedCatalogueImportFile> {
  if (file.size > catalogueImportMaxBytes) {
    throw new CatalogueImportError(
      "validation",
      "CSV／TSV 檔案不可超過 256 KiB。 / The CSV or TSV file must be 256 KiB or smaller.",
    );
  }

  const format = catalogueImportFormatForFile(file.name, file.type);
  if (!format) {
    throw new CatalogueImportError(
      "validation",
      "目錄匯入檔案必須使用相符的 CSV 或 TSV 格式。 / The catalogue import file must use a matching CSV or TSV format.",
    );
  }

  return {
    format,
    inputs: parseCatalogueImportFile(
      await decodeCatalogueImportFile(file),
      format,
    ),
  };
}
