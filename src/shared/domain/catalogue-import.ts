import { cataloguePartInputSchema, type CataloguePartInput } from "./schemas";

export const catalogueImportHeaders = [
  "sku",
  "category",
  "manufacturer",
  "model",
  "price_hkd",
  "stock_status",
  "stock_count",
  "specification_status",
  "specifications_json",
] as const;

export const catalogueImportMaxRows = 50;
export const catalogueImportMaxBytes = 256 * 1024;

export const catalogueImportMediaTypes = {
  csv: "text/csv",
  tsv: "text/tab-separated-values",
} as const;

export type CatalogueImportFormat = keyof typeof catalogueImportMediaTypes;

const syntheticTemplateValues = [
  "SYNTH-CASE-001",
  "case",
  "示範品牌",
  "示範機箱",
  "849.00",
  "in_stock",
  "6",
  "verified",
  JSON.stringify({ formFactor: "ATX", maxGpuLengthMm: 392 }),
] as const;

function delimiterFor(format: CatalogueImportFormat): "," | "\t" {
  return format === "csv" ? "," : "\t";
}

function serializeField(value: string, delimiter: "," | "\t"): string {
  return value.includes(delimiter) || /["\r\n]/u.test(value)
    ? `"${value.replaceAll('"', '""')}"`
    : value;
}

function serializeTemplate(format: CatalogueImportFormat): string {
  const delimiter = delimiterFor(format);
  return [catalogueImportHeaders, syntheticTemplateValues]
    .map((row) =>
      row.map((value) => serializeField(value, delimiter)).join(delimiter),
    )
    .join("\n");
}

export const catalogueImportTemplates = {
  csv: serializeTemplate("csv"),
  tsv: serializeTemplate("tsv"),
} as const satisfies Record<CatalogueImportFormat, string>;

export class CatalogueImportError extends Error {
  readonly kind: "sku_conflict" | "validation";

  constructor(kind: "sku_conflict" | "validation", message: string) {
    super(message);
    this.name = "CatalogueImportError";
    this.kind = kind;
  }
}

function invalid(message: string): CatalogueImportError {
  return new CatalogueImportError("validation", message);
}

function formatLabel(format: CatalogueImportFormat): "CSV" | "TSV" {
  return format === "csv" ? "CSV" : "TSV";
}

function parseDelimitedGrid(
  text: string,
  format: CatalogueImportFormat,
): string[][] {
  const delimiter = delimiterFor(format);
  const label = formatLabel(format);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let closedQuote = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;

    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
          closedQuote = true;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (
      closedQuote &&
      character !== delimiter &&
      character !== "\n" &&
      character !== "\r"
    ) {
      throw invalid(
        `${label} 引號格式無效。 / The ${label} quoting is invalid.`,
      );
    }

    if (character === '"') {
      if (format === "tsv" && field.length !== 0 && !closedQuote) {
        field += '"';
      } else if (field.length !== 0 || closedQuote) {
        throw invalid(
          `${label} 引號格式無效。 / The ${label} quoting is invalid.`,
        );
      } else {
        quoted = true;
      }
    } else if (character === delimiter) {
      row.push(field);
      field = "";
      closedQuote = false;
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") {
        index += 1;
      }
      row.push(field);
      if (row.some((value) => value.trim().length > 0)) {
        rows.push(row);
      }
      row = [];
      field = "";
      closedQuote = false;
    } else {
      field += character;
    }
  }

  if (quoted) {
    throw invalid(
      `${label} 引號未有正確關閉。 / A quoted ${label} field was not closed correctly.`,
    );
  }

  row.push(field);
  if (row.some((value) => value.trim().length > 0)) {
    rows.push(row);
  }

  return rows;
}

function parsePriceMinor(
  value: string,
  rowNumber: number,
  label: "CSV" | "TSV",
): number {
  const normalized = value.trim();
  if (!/^\d{1,6}(?:\.\d{1,2})?$/u.test(normalized)) {
    throw invalid(
      `${label} 第 ${rowNumber} 行的港幣售價無效。 / The HKD price on ${label} row ${rowNumber} is invalid.`,
    );
  }

  return Math.round(Number(normalized) * 100);
}

function parseStockCount(
  value: string,
  rowNumber: number,
  label: "CSV" | "TSV",
): number | null {
  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }
  if (!/^\d{1,6}$/u.test(normalized)) {
    throw invalid(
      `${label} 第 ${rowNumber} 行的庫存數量無效。 / The stock count on ${label} row ${rowNumber} is invalid.`,
    );
  }
  return Number(normalized);
}

function parseSpecifications(
  value: string,
  rowNumber: number,
  label: "CSV" | "TSV",
): unknown {
  const normalized = value.trim();
  if (normalized.length === 0) {
    return {};
  }

  try {
    return JSON.parse(normalized) as unknown;
  } catch {
    throw invalid(
      `${label} 第 ${rowNumber} 行的規格 JSON 無效。 / The specifications JSON on ${label} row ${rowNumber} is invalid.`,
    );
  }
}

function extensionFormat(fileName: string): CatalogueImportFormat | null {
  const normalized = fileName.trim().toLowerCase();
  if (normalized.endsWith(".csv")) {
    return "csv";
  }
  if (normalized.endsWith(".tsv")) {
    return "tsv";
  }
  return null;
}

function mediaTypeFormat(contentType: string): CatalogueImportFormat | null {
  const normalized = contentType.split(";", 1)[0]?.trim().toLowerCase();
  if (normalized === catalogueImportMediaTypes.csv) {
    return "csv";
  }
  if (normalized === catalogueImportMediaTypes.tsv) {
    return "tsv";
  }
  return null;
}

export function catalogueImportFormatForFile(
  fileName: string,
  declaredContentType: string,
): CatalogueImportFormat | null {
  const byExtension = extensionFormat(fileName);
  const byMediaType = mediaTypeFormat(declaredContentType);
  if (byExtension && byMediaType && byExtension !== byMediaType) {
    return null;
  }
  return byMediaType ?? byExtension;
}

export function parseCatalogueImportFile(
  text: string,
  format: CatalogueImportFormat,
): CataloguePartInput[] {
  const label = formatLabel(format);
  const rows = parseDelimitedGrid(text, format);
  const rawHeaders = rows.shift();
  if (!rawHeaders) {
    throw invalid(`${label} 沒有標題列。 / The ${label} has no header row.`);
  }

  const headers = rawHeaders.map((header, index) =>
    (index === 0 ? header.replace(/^\uFEFF/u, "") : header)
      .trim()
      .toLowerCase(),
  );
  if (
    headers.length !== catalogueImportHeaders.length ||
    headers.some((header, index) => header !== catalogueImportHeaders[index])
  ) {
    throw invalid(
      `${label} 欄位或次序不符合 RigStage 匯入格式。 / The ${label} columns or order do not match the RigStage import format.`,
    );
  }
  if (rows.length === 0 || rows.length > catalogueImportMaxRows) {
    throw invalid(
      `每次 ${label} 匯入必須包含 1 至 ${catalogueImportMaxRows} 項產品。 / Each ${label} import must contain between 1 and ${catalogueImportMaxRows} products.`,
    );
  }

  const inputs = rows.map((values, index) => {
    const rowNumber = index + 2;
    if (values.length !== catalogueImportHeaders.length) {
      throw invalid(
        `${label} 第 ${rowNumber} 行的欄位數量無效。 / ${label} row ${rowNumber} has an invalid number of fields.`,
      );
    }

    const parsed = cataloguePartInputSchema.safeParse({
      sku: values[0],
      category: values[1],
      manufacturer: values[2],
      model: values[3],
      priceMinor: parsePriceMinor(values[4]!, rowNumber, label),
      stockStatus: values[5]?.trim(),
      stockCount: parseStockCount(values[6]!, rowNumber, label),
      specificationStatus: values[7]?.trim(),
      specifications: parseSpecifications(values[8]!, rowNumber, label),
    });
    if (!parsed.success) {
      throw invalid(
        `${label} 第 ${rowNumber} 行的產品內容無效。 / The product data on ${label} row ${rowNumber} is invalid.`,
      );
    }
    return parsed.data;
  });

  const normalizedSkus = new Set<string>();
  for (const input of inputs) {
    const normalizedSku = input.sku.toLowerCase();
    if (normalizedSkus.has(normalizedSku)) {
      throw new CatalogueImportError(
        "sku_conflict",
        `同一份 ${label} 內有重複 SKU。 / The ${label} contains a duplicate SKU.`,
      );
    }
    normalizedSkus.add(normalizedSku);
  }

  return inputs;
}
