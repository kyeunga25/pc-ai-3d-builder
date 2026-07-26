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

export const specificationStatusSchema = z.enum(["unverified", "verified"]);
export const catalogueStatusSchema = z.enum(["active", "archived"]);

const catalogueTextSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .refine(
    (value) =>
      !Array.from(value).some((character) => {
        const codePoint = character.codePointAt(0) ?? 0;
        return codePoint <= 31 || codePoint === 127;
      }),
    { message: "Control characters are not allowed." },
  );

const catalogueSpecificationValueSchema = z.union([
  z.string().trim().max(256),
  z.number().finite().min(-1_000_000_000).max(1_000_000_000),
  z.boolean(),
]);

export const catalogueSpecificationsSchema = z
  .record(
    z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^[A-Za-z0-9_.-]+$/u),
    catalogueSpecificationValueSchema,
  )
  .refine((specifications) => Object.keys(specifications).length <= 32, {
    message: "Too many catalogue specifications.",
  });

export const catalogPartSchema = z.object({
  id: z.string().min(1),
  sku: catalogueTextSchema.max(64),
  category: componentCategorySchema,
  manufacturer: catalogueTextSchema.max(100),
  model: catalogueTextSchema,
  priceMinor: z.number().int().nonnegative().max(99_999_999),
  stockStatus: stockStatusSchema,
  stockCount: z.number().int().nonnegative().nullable(),
  specifications: catalogueSpecificationsSchema,
  specificationStatus: specificationStatusSchema,
  catalogueStatus: catalogueStatusSchema,
  assetId: z.string().min(1).nullable(),
  assetQuality: assetQualitySchema,
  assetStatus: z.enum(["approved", "needs_review", "draft", "proxy"]),
  verified: z.boolean(),
  version: z.number().int().nonnegative(),
});

export const catalogueResponseSchema = z.object({
  items: z.array(catalogPartSchema),
  nextCursor: z.string().min(1).nullable(),
});

export const cataloguePartInputSchema = z
  .object({
    sku: catalogueTextSchema.max(64),
    category: componentCategorySchema,
    manufacturer: catalogueTextSchema.max(100),
    model: catalogueTextSchema,
    priceMinor: z.number().int().nonnegative().max(99_999_999),
    stockStatus: stockStatusSchema,
    stockCount: z.number().int().nonnegative().max(999_999).nullable(),
    specifications: catalogueSpecificationsSchema,
    specificationStatus: specificationStatusSchema,
  })
  .superRefine((input, context) => {
    if (
      (input.stockStatus === "in_stock" || input.stockStatus === "low_stock") &&
      (input.stockCount === null || input.stockCount < 1)
    ) {
      context.addIssue({
        code: "custom",
        path: ["stockCount"],
        message: "Available stock requires a positive count.",
      });
    }

    if (input.stockStatus === "out_of_stock" && input.stockCount !== 0) {
      context.addIssue({
        code: "custom",
        path: ["stockCount"],
        message: "Out-of-stock catalogue parts must use a zero count.",
      });
    }
  });

export const catalogueMutationSchema = z.discriminatedUnion("action", [
  cataloguePartInputSchema.safeExtend({
    action: z.literal("update"),
    expectedVersion: z.number().int().nonnegative(),
  }),
  z.object({
    action: z.literal("archive"),
    expectedVersion: z.number().int().nonnegative(),
  }),
]);

export const catalogueImportResponseSchema = z.object({
  created: z.array(catalogPartSchema).max(50),
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
export type CataloguePartInput = z.infer<typeof cataloguePartInputSchema>;
export type CatalogueMutation = z.infer<typeof catalogueMutationSchema>;
export type CatalogueResponse = z.infer<typeof catalogueResponseSchema>;
export type CatalogueImportResponse = z.infer<
  typeof catalogueImportResponseSchema
>;
export type ComponentCategory = z.infer<typeof componentCategorySchema>;
export type StockStatus = z.infer<typeof stockStatusSchema>;
export type MockBuild = z.infer<typeof mockBuildSchema>;
