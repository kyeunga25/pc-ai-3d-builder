import { cataloguePartInputSchema, type CataloguePartInput } from "./schemas";

export const catalogueCsvHeaders = [
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

export const catalogueCsvMaxRows = 50;

export const catalogueCsvTemplate = `${catalogueCsvHeaders.join(",")}
SYNTH-CASE-001,case,示範品牌,示範機箱,849.00,in_stock,6,verified,"{""formFactor"":""ATX"",""maxGpuLengthMm"":392}"`;

export class CatalogueCsvError extends Error {
  readonly kind: "sku_conflict" | "validation";

  constructor(kind: "sku_conflict" | "validation", message: string) {
    super(message);
    this.name = "CatalogueCsvError";
    this.kind = kind;
  }
}

function invalid(message: string): CatalogueCsvError {
  return new CatalogueCsvError("validation", message);
}

function parseCsvGrid(text: string): string[][] {
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
      character !== "," &&
      character !== "\n" &&
      character !== "\r"
    ) {
      throw invalid("CSV 引號格式無效。 / The CSV quoting is invalid.");
    }

    if (character === '"') {
      if (field.length !== 0 || closedQuote) {
        throw invalid("CSV 引號格式無效。 / The CSV quoting is invalid.");
      }
      quoted = true;
    } else if (character === ",") {
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
      "CSV 引號未有正確關閉。 / A quoted CSV field was not closed correctly.",
    );
  }

  row.push(field);
  if (row.some((value) => value.trim().length > 0)) {
    rows.push(row);
  }

  return rows;
}

function parsePriceMinor(value: string, rowNumber: number): number {
  const normalized = value.trim();
  if (!/^\d{1,6}(?:\.\d{1,2})?$/u.test(normalized)) {
    throw invalid(
      `CSV 第 ${rowNumber} 行的港幣售價無效。 / The HKD price on CSV row ${rowNumber} is invalid.`,
    );
  }

  return Math.round(Number(normalized) * 100);
}

function parseStockCount(value: string, rowNumber: number): number | null {
  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }
  if (!/^\d{1,6}$/u.test(normalized)) {
    throw invalid(
      `CSV 第 ${rowNumber} 行的庫存數量無效。 / The stock count on CSV row ${rowNumber} is invalid.`,
    );
  }
  return Number(normalized);
}

function parseSpecifications(value: string, rowNumber: number): unknown {
  const normalized = value.trim();
  if (normalized.length === 0) {
    return {};
  }

  try {
    return JSON.parse(normalized) as unknown;
  } catch {
    throw invalid(
      `CSV 第 ${rowNumber} 行的規格 JSON 無效。 / The specifications JSON on CSV row ${rowNumber} is invalid.`,
    );
  }
}

export function parseCatalogueCsvFile(text: string): CataloguePartInput[] {
  const rows = parseCsvGrid(text);
  const rawHeaders = rows.shift();
  if (!rawHeaders) {
    throw invalid("CSV 沒有標題列。 / The CSV has no header row.");
  }

  const headers = rawHeaders.map((header, index) =>
    (index === 0 ? header.replace(/^\uFEFF/u, "") : header)
      .trim()
      .toLowerCase(),
  );
  if (
    headers.length !== catalogueCsvHeaders.length ||
    headers.some((header, index) => header !== catalogueCsvHeaders[index])
  ) {
    throw invalid(
      "CSV 欄位或次序不符合 RigStage 匯入格式。 / The CSV columns or order do not match the RigStage import format.",
    );
  }
  if (rows.length === 0 || rows.length > catalogueCsvMaxRows) {
    throw invalid(
      `每次 CSV 匯入必須包含 1 至 ${catalogueCsvMaxRows} 項產品。 / Each CSV import must contain between 1 and ${catalogueCsvMaxRows} products.`,
    );
  }

  const inputs = rows.map((values, index) => {
    const rowNumber = index + 2;
    if (values.length !== catalogueCsvHeaders.length) {
      throw invalid(
        `CSV 第 ${rowNumber} 行的欄位數量無效。 / CSV row ${rowNumber} has an invalid number of fields.`,
      );
    }

    const parsed = cataloguePartInputSchema.safeParse({
      sku: values[0],
      category: values[1],
      manufacturer: values[2],
      model: values[3],
      priceMinor: parsePriceMinor(values[4]!, rowNumber),
      stockStatus: values[5]?.trim(),
      stockCount: parseStockCount(values[6]!, rowNumber),
      specificationStatus: values[7]?.trim(),
      specifications: parseSpecifications(values[8]!, rowNumber),
    });
    if (!parsed.success) {
      throw invalid(
        `CSV 第 ${rowNumber} 行的產品內容無效。 / The product data on CSV row ${rowNumber} is invalid.`,
      );
    }
    return parsed.data;
  });

  const normalizedSkus = new Set<string>();
  for (const input of inputs) {
    const normalizedSku = input.sku.toLowerCase();
    if (normalizedSkus.has(normalizedSku)) {
      throw new CatalogueCsvError(
        "sku_conflict",
        "同一份 CSV 內有重複 SKU。 / The CSV contains a duplicate SKU.",
      );
    }
    normalizedSkus.add(normalizedSku);
  }

  return inputs;
}
