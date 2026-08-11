import { describe, expect, it } from "vitest";

import {
  generationDiagnosticCodeSchema,
  generationJobSchema,
} from "./generation-jobs";

function generationJob(overrides: Record<string, unknown> = {}) {
  return {
    id: "generation-code-fixture",
    assetId: "asset-code-fixture",
    status: "failed",
    kind: "simulation",
    outputReady: false,
    failureCode: "GENERATION_WORKFLOW_FAILED",
    entitlementStatus: "released",
    providerCostUnits: 0,
    validationCode: "GENERATION_OUTPUT_STRUCTURE_INVALID",
    createdAt: "2026-08-10T00:00:00.000Z",
    updatedAt: "2026-08-10T00:00:00.000Z",
    ...overrides,
  };
}

describe("generation diagnostic code schema", () => {
  it.each([
    "GLB_VALID",
    "GENERATION_WORKFLOW_FAILED",
    "GENERATION_OUTPUT_TEXTURE_LIMIT_EXCEEDED",
    `A${"B".repeat(127)}`,
  ])("accepts a bounded machine code: %s", (code) => {
    expect(generationDiagnosticCodeSchema.parse(code)).toBe(code);
  });

  it.each([
    "",
    "generation_workflow_failed",
    "GENERATION-WORKFLOW-FAILED",
    "GENERATION WORKFLOW FAILED",
    "生成失敗",
    `A${"B".repeat(128)}`,
  ])("rejects an unsafe or unbounded diagnostic code: %s", (code) => {
    expect(generationDiagnosticCodeSchema.safeParse(code).success).toBe(false);
  });

  it("applies the same boundary to public job failure and validation fields", () => {
    expect(generationJobSchema.safeParse(generationJob()).success).toBe(true);
    expect(
      generationJobSchema.safeParse(
        generationJob({ failureCode: "private parser detail" }),
      ).success,
    ).toBe(false);
    expect(
      generationJobSchema.safeParse(
        generationJob({ validationCode: "GLB-VALID" }),
      ).success,
    ).toBe(false);
  });
});
