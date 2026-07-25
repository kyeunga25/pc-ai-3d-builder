import { z } from "zod";

export const componentCategorySchema = z.enum([
  "case",
  "motherboard",
  "cpu",
  "gpu",
  "memory",
  "cooling",
  "storage",
  "psu",
  "fans",
]);

export const stockStatusSchema = z.enum([
  "in_stock",
  "low_stock",
  "out_of_stock",
  "unknown",
]);

export const assetQualitySchema = z.enum([
  "unreviewed",
  "draft",
  "reviewed",
  "approved",
]);

export const catalogPartSchema = z.object({
  id: z.string().min(1),
  sku: z.string().min(1),
  category: componentCategorySchema,
  manufacturer: z.string().min(1),
  model: z.string().min(1),
  priceMinor: z.number().int().nonnegative(),
  stockStatus: stockStatusSchema,
  stockCount: z.number().int().nonnegative().nullable(),
  assetQuality: assetQualitySchema,
  assetStatus: z.enum(["approved", "needs_review", "draft", "proxy"]),
  verified: z.boolean(),
});

export const catalogueResponseSchema = z.object({
  items: z.array(catalogPartSchema),
  nextCursor: z.string().min(1).nullable(),
});

export const mockBuildSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  selectedPartIds: z.array(z.string().min(1)),
  warningCount: z.number().int().nonnegative(),
  hardErrorCount: z.number().int().nonnegative(),
  estimatedWatts: z.number().int().positive(),
  totalPriceMinor: z.number().int().nonnegative(),
});

export type CatalogPart = z.infer<typeof catalogPartSchema>;
export type CatalogueResponse = z.infer<typeof catalogueResponseSchema>;
export type ComponentCategory = z.infer<typeof componentCategorySchema>;
export type MockBuild = z.infer<typeof mockBuildSchema>;
