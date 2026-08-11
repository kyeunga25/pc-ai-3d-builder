import { z } from "zod";

export const dashboardMetricsSchema = z.object({
  activeCatalogueCount: z.number().int().nonnegative(),
  verifiedCatalogueCount: z.number().int().nonnegative(),
  approvedAssetCount: z.number().int().nonnegative(),
  catalogueReadyCount: z.number().int().nonnegative(),
  pendingAssetCount: z.number().int().nonnegative(),
  draftBuildCount: z.number().int().nonnegative(),
  evaluatedBuildCount: z.number().int().nonnegative().max(50),
  readyBuildCount: z.number().int().nonnegative().max(50),
  attentionBuildCount: z.number().int().nonnegative().max(50),
});

export const dashboardWorkItemSchema = z
  .object({
    kind: z.enum(["asset_review", "build_ready", "build_attention"]),
    title: z.string().trim().min(1).max(240),
    detailZhHant: z.string().trim().min(1).max(240),
    detailEnglish: z.string().trim().min(1).max(240),
    statusZhHant: z.string().trim().min(1).max(80),
    statusEnglish: z.string().trim().min(1).max(80),
    tone: z.enum(["info", "success", "warning", "danger"]),
    href: z.enum(["/asset-review", "/builder"]),
    targetAssetId: z
      .string()
      .regex(/^[A-Za-z0-9_-]{1,128}$/u)
      .nullable(),
    updatedAt: z.string().trim().min(1).max(64),
  })
  .superRefine((item, context) => {
    const isAssetReview = item.kind === "asset_review";
    if (
      (isAssetReview &&
        (item.href !== "/asset-review" || item.targetAssetId === null)) ||
      (!isAssetReview &&
        (item.href !== "/builder" || item.targetAssetId !== null))
    ) {
      context.addIssue({
        code: "custom",
        message: "Dashboard work target does not match its kind",
      });
    }
  });

export const dashboardResponseSchema = z.object({
  metrics: dashboardMetricsSchema,
  recentWork: z.array(dashboardWorkItemSchema).max(6),
});

export type DashboardMetrics = z.infer<typeof dashboardMetricsSchema>;
export type DashboardWorkItem = z.infer<typeof dashboardWorkItemSchema>;
export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;
