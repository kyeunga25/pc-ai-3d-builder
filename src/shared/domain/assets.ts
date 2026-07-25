import { z } from "zod";

export const assetReviewChecks = [
  "model_identity",
  "variant_identity",
  "standard_orientation",
  "verified_dimensions",
  "installation_pivot",
  "source_rights",
] as const;

export const assetReviewCheckSchema = z.enum(assetReviewChecks);
export const assetReviewStatusSchema = z.enum([
  "draft",
  "in_review",
  "approved",
  "rejected",
]);
export const assetSourceKindSchema = z.enum([
  "synthetic",
  "uploaded",
  "generated",
]);

const dimensionSchema = z.number().finite().positive().max(10_000).nullable();

export const assetDimensionsSchema = z.object({
  width: dimensionSchema,
  height: dimensionSchema,
  depth: dimensionSchema,
});

export const assetReviewItemSchema = z.object({
  id: z.string().min(1),
  part: z.object({
    id: z.string().min(1),
    sku: z.string().min(1),
    manufacturer: z.string().min(1),
    model: z.string().min(1),
  }),
  status: assetReviewStatusSchema,
  quality: z.enum(["unreviewed", "draft", "reviewed", "approved"]),
  sourceKind: assetSourceKindSchema,
  completedChecks: z
    .array(assetReviewCheckSchema)
    .max(assetReviewChecks.length)
    .refine((checks) => new Set(checks).size === checks.length, {
      message: "Review checks must be unique.",
    }),
  sourceRightsConfirmed: z.boolean(),
  dimensionsMm: assetDimensionsSchema,
  version: z.number().int().nonnegative(),
});

export const assetReviewQueueResponseSchema = z.object({
  items: z.array(assetReviewItemSchema),
});

export const assetReviewMutationSchema = z.object({
  action: z.enum(["save_draft", "approve", "reject"]),
  expectedVersion: z.number().int().nonnegative(),
  completedChecks: z
    .array(assetReviewCheckSchema)
    .max(assetReviewChecks.length)
    .refine((checks) => new Set(checks).size === checks.length, {
      message: "Review checks must be unique.",
    }),
  dimensionsMm: assetDimensionsSchema,
});

export type AssetReviewCheck = z.infer<typeof assetReviewCheckSchema>;
export type AssetReviewItem = z.infer<typeof assetReviewItemSchema>;
export type AssetReviewMutation = z.infer<typeof assetReviewMutationSchema>;
