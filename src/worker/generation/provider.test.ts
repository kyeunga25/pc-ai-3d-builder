import { describe, expect, it } from "vitest";

import { validateAssetFileBytes } from "../../shared/domain/asset-files";
import {
  createGenerationProvider,
  generationOutputRequirements,
  generationRuntimeConfig,
  type GenerationProviderInput,
} from "./provider";

const providerInput: GenerationProviderInput = {
  attemptRef: `gref_${"a".repeat(32)}`,
  jobRef: `gref_${"b".repeat(32)}`,
  workspaceRef: `gref_${"c".repeat(32)}`,
  source: {
    contentType: "image/png",
    sha256: "d".repeat(64),
    sizeBytes: 128,
  },
  requirements: generationOutputRequirements,
};

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

  it("produces only a bounded synthetic draft in simulation mode", async () => {
    const runtime = generationRuntimeConfig({
      GENERATION_MODE: "simulation",
      GENERATION_MAX_COST_MINOR: "0",
    });
    const output = await createGenerationProvider(runtime.mode).generateDraft(
      providerInput,
    );

    expect(output.providerCostUnits).toBe(1);
    expect(
      validateAssetFileBytes("model", output.contentType, output.bytes),
    ).toBe("model/gltf-binary");
  });

  it("rejects generation while the kill switch is disabled", async () => {
    await expect(
      createGenerationProvider("disabled").generateDraft({
        ...providerInput,
      }),
    ).rejects.toMatchObject({ code: "GENERATION_KILL_SWITCH" });
  });
});
