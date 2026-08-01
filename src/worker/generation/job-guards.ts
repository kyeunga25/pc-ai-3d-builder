export type GenerationGuardState = {
  assetStatus: string;
  inputSha256: string;
  jobStatus: string;
  maxCostMinor: number;
  outputObjectKey: string | null;
  requestedReviewVersion: number;
  reviewVersion: number;
  sourceObjectKey: string | null;
  sourceRightsConfirmed: number;
  sourceSha256: string | null;
};

export type GenerationClaimDisposition =
  | { kind: "completed" }
  | { kind: "runnable" }
  | { code: string; kind: "rejected" };

function inputIsCurrent(
  state: GenerationGuardState,
  requestedReviewVersion: number,
): boolean {
  return (
    state.requestedReviewVersion === requestedReviewVersion &&
    state.reviewVersion === requestedReviewVersion &&
    state.sourceObjectKey !== null &&
    state.sourceRightsConfirmed === 1 &&
    state.sourceSha256 === state.inputSha256 &&
    state.assetStatus !== "approved"
  );
}

export function generationClaimDisposition(
  state: GenerationGuardState,
  requestedReviewVersion: number,
): GenerationClaimDisposition {
  if (state.jobStatus === "awaiting_review") {
    return state.outputObjectKey
      ? { kind: "completed" }
      : { kind: "rejected", code: "GENERATION_OUTPUT_MISSING" };
  }
  if (!["queued", "running", "validating"].includes(state.jobStatus)) {
    return { kind: "rejected", code: "GENERATION_JOB_NOT_RUNNABLE" };
  }
  return inputIsCurrent(state, requestedReviewVersion)
    ? { kind: "runnable" }
    : { kind: "rejected", code: "GENERATION_INPUT_STALE" };
}

export function generationStageFailure(
  state: GenerationGuardState,
  requestedReviewVersion: number,
  actualCostMinor: number,
): string | null {
  if (actualCostMinor > state.maxCostMinor) {
    return "GENERATION_COST_CAP_EXCEEDED";
  }
  return state.jobStatus === "validating" &&
    inputIsCurrent(state, requestedReviewVersion)
    ? null
    : "GENERATION_INPUT_STALE";
}
