import { assetModelContentType } from "../../shared/domain/asset-files";
import { createSyntheticDraftGlb } from "../../shared/domain/synthetic-glb";

export type GenerationRuntimeMode = "disabled" | "simulation";

export type GeneratedDraft = {
  bytes: Uint8Array;
  contentType: typeof assetModelContentType;
  actualCostMinor: number;
};

export type GenerationProviderInput = {
  jobId: string;
  inputSha256: string;
};

export interface GenerationProvider {
  generateDraft(input: GenerationProviderInput): Promise<GeneratedDraft>;
}

export class GenerationProviderUnavailableError extends Error {
  readonly code = "GENERATION_KILL_SWITCH";

  constructor() {
    super("Generation is disabled.");
    this.name = "GenerationProviderUnavailableError";
  }
}

class DisabledGenerationProvider implements GenerationProvider {
  generateDraft(): Promise<GeneratedDraft> {
    return Promise.reject(new GenerationProviderUnavailableError());
  }
}

class SyntheticGenerationProvider implements GenerationProvider {
  generateDraft(input: GenerationProviderInput): Promise<GeneratedDraft> {
    if (!input.jobId || !/^[a-f0-9]{64}$/u.test(input.inputSha256)) {
      return Promise.reject(
        new Error("Synthetic generation input is invalid."),
      );
    }
    return Promise.resolve({
      bytes: createSyntheticDraftGlb(),
      contentType: assetModelContentType,
      actualCostMinor: 0,
    });
  }
}

export function generationRuntimeConfig(env: {
  GENERATION_MAX_COST_MINOR: string;
  GENERATION_MODE: string;
}): { mode: GenerationRuntimeMode; maxCostMinor: number } {
  const mode = env.GENERATION_MODE?.trim().toLowerCase();
  const rawCost = env.GENERATION_MAX_COST_MINOR?.trim();
  const maxCostMinor = /^\d{1,10}$/u.test(rawCost) ? Number(rawCost) : NaN;
  if (
    mode !== "simulation" ||
    !Number.isSafeInteger(maxCostMinor) ||
    maxCostMinor !== 0
  ) {
    return { mode: "disabled", maxCostMinor: 0 };
  }
  return { mode, maxCostMinor };
}

export function createGenerationProvider(
  mode: GenerationRuntimeMode,
): GenerationProvider {
  return mode === "simulation"
    ? new SyntheticGenerationProvider()
    : new DisabledGenerationProvider();
}
