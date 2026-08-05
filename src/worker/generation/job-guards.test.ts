import { describe, expect, it } from "vitest";

import {
  generationClaimDisposition,
  generationStageFailure,
  type GenerationGuardState,
} from "./job-guards";

function state(
  overrides: Partial<GenerationGuardState> = {},
): GenerationGuardState {
  return {
    assetStatus: "draft",
    entitlementStatus: "reserved",
    inputSha256: "a".repeat(64),
    jobStatus: "queued",
    maxProviderCostUnits: 1,
    outputObjectKey: null,
    requestedReviewVersion: 2,
    reviewVersion: 2,
    sourceObjectKey: "private/source",
    sourceRightsConfirmed: 1,
    sourceSha256: "a".repeat(64),
    ...overrides,
  };
}

describe("generation job guards", () => {
  it("accepts only a current, rights-confirmed runnable input", () => {
    expect(generationClaimDisposition(state(), 2)).toEqual({
      kind: "runnable",
    });
    expect(generationClaimDisposition(state({ reviewVersion: 3 }), 2)).toEqual({
      kind: "rejected",
      code: "GENERATION_INPUT_STALE",
    });
    expect(
      generationClaimDisposition(state({ sourceRightsConfirmed: 0 }), 2),
    ).toEqual({ kind: "rejected", code: "GENERATION_INPUT_STALE" });
    expect(
      generationClaimDisposition(state({ sourceSha256: "b".repeat(64) }), 2),
    ).toEqual({ kind: "rejected", code: "GENERATION_INPUT_STALE" });
    expect(
      generationClaimDisposition(state({ assetStatus: "approved" }), 2),
    ).toEqual({ kind: "rejected", code: "GENERATION_INPUT_STALE" });
  });

  it("treats a completed output as idempotent after review evidence resets", () => {
    expect(
      generationClaimDisposition(
        state({
          jobStatus: "awaiting_review",
          outputObjectKey: "private/output",
          reviewVersion: 3,
          sourceRightsConfirmed: 0,
        }),
        2,
      ),
    ).toEqual({ kind: "completed" });
    expect(
      generationClaimDisposition(state({ jobStatus: "failed" }), 2),
    ).toEqual({
      kind: "rejected",
      code: "GENERATION_JOB_NOT_RUNNABLE",
    });
  });

  it("enforces the cost cap and current input before staging", () => {
    const validating = state({ jobStatus: "validating" });

    expect(generationStageFailure(validating, 2, 1)).toBeNull();
    expect(generationStageFailure(validating, 2, 2)).toBe(
      "GENERATION_COST_CAP_EXCEEDED",
    );
    expect(
      generationStageFailure({ ...validating, sourceRightsConfirmed: 0 }, 2, 0),
    ).toBe("GENERATION_INPUT_STALE");
  });

  it("requires a reserved generation entitlement", () => {
    expect(
      generationClaimDisposition(state({ entitlementStatus: "released" }), 2),
    ).toEqual({
      kind: "rejected",
      code: "GENERATION_ENTITLEMENT_MISSING",
    });
  });
});
