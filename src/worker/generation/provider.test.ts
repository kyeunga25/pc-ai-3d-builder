import { describe, expect, it } from "vitest";

import { validateAssetFileBytes } from "../../shared/domain/asset-files";
import { createGenerationProvider, generationRuntimeConfig } from "./provider";

describe("generation provider boundary", () => {
  it("fails closed for unknown or non-zero-cost configuration", () => {
    expect(
      generationRuntimeConfig({
        GENERATION_MODE: "external",
        GENERATION_MAX_COST_MINOR: "100",
      }),
    ).toEqual({ mode: "disabled", maxCostMinor: 0 });
    expect(
      generationRuntimeConfig({
        GENERATION_MODE: "simulation",
        GENERATION_MAX_COST_MINOR: "1",
      }),
    ).toEqual({ mode: "disabled", maxCostMinor: 0 });
  });

  it("produces only a zero-cost synthetic draft in simulation mode", async () => {
    const runtime = generationRuntimeConfig({
      GENERATION_MODE: "simulation",
      GENERATION_MAX_COST_MINOR: "0",
    });
    const output = await createGenerationProvider(runtime.mode).generateDraft({
      jobId: "generation-fixture",
      inputSha256: "a".repeat(64),
    });

    expect(output.actualCostMinor).toBe(0);
    expect(
      validateAssetFileBytes("model", output.contentType, output.bytes),
    ).toBe("model/gltf-binary");
  });

  it("rejects generation while the kill switch is disabled", async () => {
    await expect(
      createGenerationProvider("disabled").generateDraft({
        jobId: "generation-fixture",
        inputSha256: "a".repeat(64),
      }),
    ).rejects.toMatchObject({ code: "GENERATION_KILL_SWITCH" });
  });
});
