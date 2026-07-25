import {
  catalogueResponseSchema,
  catalogPartSchema,
  componentCategorySchema,
  type CatalogPart,
  type ComponentCategory,
} from "../../shared/domain/schemas";
import type { RequestContext } from "../auth/workspace";
import { ApiError } from "../lib/api-error";

type CatalogueRow = {
  id: string;
  sku: string;
  category: string;
  manufacturer: string;
  model: string;
  price_minor: number;
  stock_status: string;
  stock_count: number | null;
  specification_status: string;
  asset_quality: string | null;
  asset_review_status: string | null;
};

type CatalogueOptions = {
  cursor: string | null;
  category: ComponentCategory | null;
  limit: number;
};

const recordIdPattern = /^[A-Za-z0-9_-]{1,128}$/u;

function validationError(): ApiError {
  return new ApiError(400, "VALIDATION_ERROR", "產品目錄篩選條件無效。");
}

export function parseCatalogueOptions(url: URL): CatalogueOptions {
  const rawLimit = url.searchParams.get("limit");
  const limit = rawLimit === null ? 50 : Number(rawLimit);

  if (
    (rawLimit !== null && !/^\d{1,3}$/u.test(rawLimit)) ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    throw validationError();
  }

  const rawCursor = url.searchParams.get("cursor");
  if (rawCursor !== null && !recordIdPattern.test(rawCursor)) {
    throw validationError();
  }

  const rawCategory = url.searchParams.get("category");
  const categoryResult = rawCategory
    ? componentCategorySchema.safeParse(rawCategory)
    : null;

  if (categoryResult && !categoryResult.success) {
    throw validationError();
  }

  return {
    cursor: rawCursor,
    category: categoryResult?.data ?? null,
    limit,
  };
}

function mapAssetStatus(status: string | null): CatalogPart["assetStatus"] {
  switch (status) {
    case "approved":
      return "approved";
    case "in_review":
      return "needs_review";
    case "draft":
      return "draft";
    case "rejected":
    case null:
      return "proxy";
    default:
      throw new Error("Unexpected asset review status.");
  }
}

function mapCatalogueRow(row: CatalogueRow): CatalogPart {
  return catalogPartSchema.parse({
    id: row.id,
    sku: row.sku,
    category: row.category,
    manufacturer: row.manufacturer,
    model: row.model,
    priceMinor: row.price_minor,
    stockStatus: row.stock_status,
    stockCount: row.stock_count,
    assetQuality: row.asset_quality ?? "unreviewed",
    assetStatus: mapAssetStatus(row.asset_review_status),
    verified: row.specification_status === "verified",
  });
}

export async function catalogueResponse(
  db: D1Database,
  context: RequestContext,
  url: URL,
): Promise<Response> {
  const options = parseCatalogueOptions(url);
  const clauses = ["p.workspace_id = ?", "p.status = 'active'"];
  const values: Array<number | string> = [context.currentWorkspace.id];

  if (options.category) {
    clauses.push("p.category = ?");
    values.push(options.category);
  }

  if (options.cursor) {
    clauses.push("p.id > ?");
    values.push(options.cursor);
  }

  values.push(options.limit + 1);

  const result = await db
    .prepare(
      `SELECT p.id, p.sku, p.category, p.manufacturer, p.model,
              p.price_minor, p.stock_status, p.stock_count,
              p.specification_status, a.quality AS asset_quality,
              a.status AS asset_review_status
       FROM catalog_parts AS p
       LEFT JOIN product_assets AS a
         ON a.workspace_id = p.workspace_id
        AND a.catalog_part_id = p.id
       WHERE ${clauses.join(" AND ")}
       ORDER BY p.id
       LIMIT ?`,
    )
    .bind(...values)
    .all<CatalogueRow>();

  const hasMore = result.results.length > options.limit;
  const rows = hasMore
    ? result.results.slice(0, options.limit)
    : result.results;
  const items = rows.map(mapCatalogueRow);
  const body = catalogueResponseSchema.parse({
    items,
    nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
  });

  return Response.json(body, {
    headers: { "cache-control": "no-store" },
  });
}
