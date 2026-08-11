import { z } from "zod";

export const generationJobStatusSchema = z.enum([
  "queued",
  "running",
  "validating",
  "awaiting_review",
  "failed",
  "cancelled",
]);

export const generationCapabilitySchema = z.object({
  mode: z.enum(["disabled", "simulation"]),
  maxCostMinor: z.number().int().nonnegative(),
  credits: z.object({
    availableUnits: z.number().int().nonnegative(),
    reservedUnits: z.number().int().nonnegative(),
    settledUnits: z.number().int().nonnegative(),
    releasedUnits: z.number().int().nonnegative(),
  }),
});

export const generationEntitlementStatusSchema = z.enum([
  "reserved",
  "settled",
  "released",
]);

export const generationDiagnosticCodeSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Z][A-Z0-9_]*$/u);

export const generationJobSchema = z.object({
  id: z.string().min(1),
  assetId: z.string().min(1),
  status: generationJobStatusSchema,
  kind: z.literal("simulation"),
  outputReady: z.boolean(),
  failureCode: generationDiagnosticCodeSchema.nullable(),
  entitlementStatus: generationEntitlementStatusSchema.nullable(),
  providerCostUnits: z.number().int().nonnegative().nullable(),
  validationCode: generationDiagnosticCodeSchema.nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const generationJobListResponseSchema = z.object({
  capability: generationCapabilitySchema,
  items: z.array(generationJobSchema).max(20),
});

export const generationJobStartInputSchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
});

export type GenerationCapability = z.infer<typeof generationCapabilitySchema>;
export type GenerationCreditSummary = GenerationCapability["credits"];
export type GenerationEntitlementStatus = z.infer<
  typeof generationEntitlementStatusSchema
>;
export type GenerationJob = z.infer<typeof generationJobSchema>;
export type GenerationJobListResponse = z.infer<
  typeof generationJobListResponseSchema
>;
export type GenerationJobStatus = z.infer<typeof generationJobStatusSchema>;
export type GenerationJobStartInput = z.infer<
  typeof generationJobStartInputSchema
>;

export type AssetGenerationParams = {
  jobId: string;
  workspaceId: string;
  assetId: string;
  requestedReviewVersion: number;
};
