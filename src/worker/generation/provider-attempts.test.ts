import { describe, expect, it } from "vitest";

import { providerResultDisposition } from "./provider-attempts";

describe("provider attempt ordering", () => {
  it("applies the first matching result", () => {
    expect(
      providerResultDisposition(
        {
          attemptKey: "primary",
          attemptStatus: "started",
          jobStatus: "running",
        },
        { attemptKey: "primary", status: "succeeded" },
      ),
    ).toEqual({ kind: "apply" });
  });

  it("treats a repeated terminal result as idempotent", () => {
    expect(
      providerResultDisposition(
        {
          attemptKey: "primary",
          attemptStatus: "succeeded",
          jobStatus: "validating",
        },
        { attemptKey: "primary", status: "succeeded" },
      ),
    ).toEqual({ kind: "duplicate" });
  });

  it("rejects out-of-order, conflicting, and late results", () => {
    expect(
      providerResultDisposition(
        {
          attemptKey: "primary",
          attemptStatus: "started",
          jobStatus: "running",
        },
        { attemptKey: "secondary", status: "succeeded" },
      ),
    ).toEqual({ kind: "rejected", code: "GENERATION_RESULT_OUT_OF_ORDER" });
    expect(
      providerResultDisposition(
        {
          attemptKey: "primary",
          attemptStatus: "failed",
          jobStatus: "running",
        },
        { attemptKey: "primary", status: "succeeded" },
      ),
    ).toEqual({ kind: "rejected", code: "GENERATION_RESULT_CONFLICT" });
    expect(
      providerResultDisposition(
        {
          attemptKey: "primary",
          attemptStatus: "started",
          jobStatus: "awaiting_review",
        },
        { attemptKey: "primary", status: "succeeded" },
      ),
    ).toEqual({ kind: "rejected", code: "GENERATION_RESULT_LATE" });
  });
});
