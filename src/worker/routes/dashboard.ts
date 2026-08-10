import {
  dashboardResponseSchema,
  type DashboardWorkItem,
} from "../../shared/domain/dashboard";
import { composeBuildRecord } from "../../shared/domain/builds";
import type { CatalogPart } from "../../shared/domain/schemas";
import type { RequestContext } from "../auth/workspace";
import { mapCatalogueRow, type CatalogueRow } from "./catalogue";

type DashboardMetricRow = {
  active_catalogue_count: number;
  verified_catalogue_count: number;
  approved_asset_count: number;
  catalogue_ready_count: number;
  pending_asset_count: number;
  draft_build_count: number;
};

type DashboardBuildRow = {
  id: string;
  name: string;
  record_version: number;
  updated_at: string;
};

type DashboardBuildPartRow = CatalogueRow & {
  build_id: string;
};

type DashboardAssetRow = {
  id: string;
  status: "draft" | "in_review";
  manufacturer: string;
  model: string;
  updated_at: string;
};

function timestampValue(value: string): number {
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/u.test(value)
    ? `${value.replace(" ", "T")}Z`
    : value;
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function metric(value: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error("Dashboard aggregate returned an invalid count.");
  }
  return parsed;
}

export async function dashboardResponse(
  db: D1Database,
  context: RequestContext,
): Promise<Response> {
  const workspaceId = context.currentWorkspace.id;
  const [metricRow, buildResult, assetResult] = await Promise.all([
    db
      .prepare(
        `SELECT
           (
             SELECT COUNT(*)
             FROM catalog_parts
             WHERE workspace_id = ?1 AND status = 'active'
           ) AS active_catalogue_count,
           (
             SELECT COUNT(*)
             FROM catalog_parts
             WHERE workspace_id = ?1
               AND status = 'active'
               AND specification_status = 'verified'
           ) AS verified_catalogue_count,
           (
             SELECT COUNT(*)
             FROM catalog_parts AS p
             INNER JOIN product_assets AS a
               ON a.workspace_id = p.workspace_id
              AND a.catalog_part_id = p.id
             WHERE p.workspace_id = ?1
               AND p.status = 'active'
               AND a.status = 'approved'
           ) AS approved_asset_count,
           (
             SELECT COUNT(*)
             FROM catalog_parts AS p
             INNER JOIN product_assets AS a
               ON a.workspace_id = p.workspace_id
              AND a.catalog_part_id = p.id
             WHERE p.workspace_id = ?1
               AND p.status = 'active'
               AND p.specification_status = 'verified'
               AND a.status = 'approved'
           ) AS catalogue_ready_count,
           (
             SELECT COUNT(*)
             FROM product_assets AS a
             INNER JOIN catalog_parts AS p
               ON p.workspace_id = a.workspace_id
              AND p.id = a.catalog_part_id
             WHERE a.workspace_id = ?1
               AND p.status = 'active'
               AND a.status IN ('draft', 'in_review')
           ) AS pending_asset_count,
           (
             SELECT COUNT(*)
             FROM builds
             WHERE workspace_id = ?1 AND status = 'draft'
           ) AS draft_build_count`,
      )
      .bind(workspaceId)
      .first<DashboardMetricRow>(),
    db
      .prepare(
        `SELECT id, name, record_version, updated_at
         FROM builds
         WHERE workspace_id = ?1 AND status = 'draft'
         ORDER BY updated_at DESC, id
         LIMIT 50`,
      )
      .bind(workspaceId)
      .all<DashboardBuildRow>(),
    db
      .prepare(
        `SELECT a.id, a.status, p.manufacturer, p.model, a.updated_at
         FROM product_assets AS a
         INNER JOIN catalog_parts AS p
           ON p.workspace_id = a.workspace_id
          AND p.id = a.catalog_part_id
         WHERE a.workspace_id = ?1
           AND p.status = 'active'
           AND a.status IN ('draft', 'in_review')
         ORDER BY a.updated_at DESC, a.id
         LIMIT 6`,
      )
      .bind(workspaceId)
      .all<DashboardAssetRow>(),
  ]);

  if (!metricRow) {
    throw new Error("Dashboard aggregate query returned no row.");
  }

  const buildParts = new Map<string, CatalogPart[]>();
  if (buildResult.results.length > 0) {
    const placeholders = buildResult.results
      .map((_, index) => `?${index + 2}`)
      .join(", ");
    const selectedResult = await db
      .prepare(
        `SELECT bi.build_id, p.id, p.sku, p.category, p.manufacturer,
                p.model, p.price_minor, p.stock_status, p.stock_count,
                p.specifications_json, p.specification_status, p.status,
                p.record_version, a.id AS asset_id,
                a.quality AS asset_quality,
                a.status AS asset_review_status
         FROM build_items AS bi
         INNER JOIN catalog_parts AS p
           ON bi.workspace_id = p.workspace_id
          AND bi.catalog_part_id = p.id
         LEFT JOIN product_assets AS a
           ON a.workspace_id = p.workspace_id
          AND a.catalog_part_id = p.id
         WHERE bi.workspace_id = ?1
           AND bi.build_id IN (${placeholders})
         ORDER BY bi.build_id, bi.category`,
      )
      .bind(workspaceId, ...buildResult.results.map((build) => build.id))
      .all<DashboardBuildPartRow>();

    for (const row of selectedResult.results) {
      const parts = buildParts.get(row.build_id) ?? [];
      parts.push(mapCatalogueRow(row));
      buildParts.set(row.build_id, parts);
    }
  }

  const builds = buildResult.results.map((row) =>
    composeBuildRecord({
      id: row.id,
      name: row.name,
      status: "draft",
      selectedParts: buildParts.get(row.id) ?? [],
      version: row.record_version,
      updatedAt: row.updated_at,
    }),
  );
  const readyBuildCount = builds.filter(
    (build) =>
      build.summary.errorCount === 0 && build.summary.unknownCount === 0,
  ).length;
  const attentionBuildCount = builds.length - readyBuildCount;

  const recentWork: DashboardWorkItem[] = [
    ...assetResult.results.map((asset): DashboardWorkItem => ({
      kind: "asset_review",
      title: `${asset.manufacturer} ${asset.model}`,
      detailZhHant:
        asset.status === "in_review"
          ? "3D 素材正在審核"
          : "3D 素材草稿等待處理",
      statusZhHant: asset.status === "in_review" ? "審核中" : "需要審核",
      tone: "warning",
      href: "/asset-review",
      targetAssetId: asset.id,
      updatedAt: asset.updated_at,
    })),
    ...builds.map((build): DashboardWorkItem => {
      const hasError = build.summary.errorCount > 0;
      const ready = !hasError && build.summary.unknownCount === 0;
      return {
        kind: ready ? "build_ready" : "build_attention",
        title: build.name,
        detailZhHant: ready
          ? `${build.selectedParts.length} 個組件 · 可安全匯出`
          : `${build.summary.errorCount} 個嚴重錯誤 · ${build.summary.unknownCount} 個未知結果`,
        statusZhHant: ready ? "可匯出" : hasError ? "需要修正" : "資料未齊",
        tone: ready ? "success" : hasError ? "danger" : "warning",
        href: "/builder",
        targetAssetId: null,
        updatedAt: build.updatedAt,
      };
    }),
  ]
    .sort(
      (left, right) =>
        timestampValue(right.updatedAt) - timestampValue(left.updatedAt),
    )
    .slice(0, 6);

  return Response.json(
    dashboardResponseSchema.parse({
      metrics: {
        activeCatalogueCount: metric(metricRow.active_catalogue_count),
        verifiedCatalogueCount: metric(metricRow.verified_catalogue_count),
        approvedAssetCount: metric(metricRow.approved_asset_count),
        catalogueReadyCount: metric(metricRow.catalogue_ready_count),
        pendingAssetCount: metric(metricRow.pending_asset_count),
        draftBuildCount: metric(metricRow.draft_build_count),
        evaluatedBuildCount: builds.length,
        readyBuildCount,
        attentionBuildCount,
      },
      recentWork,
    }),
    { headers: { "cache-control": "no-store" } },
  );
}
