import {
  assetFileLimits,
  assetModelContentType,
  type AssetSourceContentType,
} from "../../shared/domain/asset-files";
import { rigStageGlbSafetyPolicy } from "../../shared/domain/glb-validation";
import { createSyntheticDraftGlb } from "../../shared/domain/synthetic-glb";
import { syntheticProviderCostLimitUnits } from "./accounting";

export type GenerationRuntimeMode = "disabled" | "simulation";

export type GeneratedDraft = {
  bytes: Uint8Array;
  contentType: typeof assetModelContentType;
  providerCostUnits: number;
};

export type GenerationOutputRequirements = {
  format: "glb";
  selfContained: true;
  maxBytes: number;
  maxDecodedGeometryBytes: number;
  maxDimensionMm: number;
  maxNodes: number;
  maxPrimitives: number;
  maxTriangles: number;
  maxTextures: number;
  maxTextureBytes: number;
};

export type GenerationSourceDescriptor = {
  contentType: AssetSourceContentType;
  sha256: string;
  sizeBytes: number;
};

export type GenerationProviderInput = {
  attemptRef: string;
  jobRef: string;
  workspaceRef: string;
  source: GenerationSourceDescriptor;
  requirements: GenerationOutputRequirements;
};

export const generationOutputRequirements = {
  format: "glb",
  ...rigStageGlbSafetyPolicy,
} as const satisfies GenerationOutputRequirements;

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
    const refs = [input.attemptRef, input.jobRef, input.workspaceRef];
    const validRequirements =
      input.requirements.format === generationOutputRequirements.format &&
      input.requirements.selfContained &&
      input.requirements.maxBytes === generationOutputRequirements.maxBytes &&
      input.requirements.maxDecodedGeometryBytes ===
        generationOutputRequirements.maxDecodedGeometryBytes &&
      input.requirements.maxDimensionMm ===
        generationOutputRequirements.maxDimensionMm &&
      input.requirements.maxNodes === generationOutputRequirements.maxNodes &&
      input.requirements.maxPrimitives ===
        generationOutputRequirements.maxPrimitives &&
      input.requirements.maxTriangles ===
        generationOutputRequirements.maxTriangles &&
      input.requirements.maxTextures ===
        generationOutputRequirements.maxTextures &&
      input.requirements.maxTextureBytes ===
        generationOutputRequirements.maxTextureBytes;
    if (
      refs.some((ref) => !/^gref_[a-f0-9]{32}$/u.test(ref)) ||
      !/^[a-f0-9]{64}$/u.test(input.source.sha256) ||
      input.source.sizeBytes <= 0 ||
      input.source.sizeBytes > assetFileLimits.source ||
      !["image/jpeg", "image/png", "image/webp"].includes(
        input.source.contentType,
      ) ||
      !validRequirements
    ) {
      return Promise.reject(
        new Error("Synthetic generation input is invalid."),
      );
    }
    return Promise.resolve({
      bytes: createSyntheticDraftGlb(),
      contentType: assetModelContentType,
      providerCostUnits: syntheticProviderCostLimitUnits,
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
