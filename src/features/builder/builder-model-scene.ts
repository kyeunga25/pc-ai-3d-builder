import { assetModelContentType } from "../../shared/domain/asset-files";
import type {
  CatalogPart,
  ComponentCategory,
} from "../../shared/domain/schemas";
import { createSyntheticDraftGlb } from "../../shared/domain/synthetic-glb";
import {
  createAbortBoundObjectUrl,
  type AbortBoundObjectUrl,
} from "../../shared/lib/private-object-url";
import { fetchAssetFileBlob } from "../asset-review/asset-review-api";
import type { BuilderStepId } from "./builder-viewport-copy";

const builderModelCategoryOrder = [
  "case",
  "motherboard",
  "cpu",
  "gpu",
  "memory",
  "cooling",
  "storage",
  "psu",
  "fans",
] as const satisfies readonly ComponentCategory[];

export type BuilderModelCandidate = {
  readonly assetId: string;
  readonly category: ComponentCategory;
  readonly key: ComponentCategory;
  readonly source: "local-synthetic" | "private";
};

export type BuilderModelResource = {
  readonly key: ComponentCategory;
  readonly url: string;
};

type SelectBuilderModelCandidatesInput = {
  readonly isLocalPreview: boolean;
  readonly selectedCategory: BuilderStepId;
  readonly selectedParts: readonly CatalogPart[];
};

export function selectBuilderModelCandidates({
  isLocalPreview,
  selectedCategory,
  selectedParts,
}: SelectBuilderModelCandidatesInput): BuilderModelCandidate[] {
  const categories =
    selectedCategory === "summary"
      ? builderModelCategoryOrder
      : ([selectedCategory] as const);
  const selectedByCategory = new Map<ComponentCategory, CatalogPart>();
  for (const part of selectedParts) {
    if (!selectedByCategory.has(part.category)) {
      selectedByCategory.set(part.category, part);
    }
  }

  const candidates: BuilderModelCandidate[] = [];
  for (const category of categories) {
    const part = selectedByCategory.get(category);
    if (
      !part?.assetId ||
      part.assetStatus !== "approved" ||
      candidates.length >= 9
    ) {
      continue;
    }
    candidates.push({
      assetId: part.assetId,
      category,
      key: category,
      source: isLocalPreview ? "local-synthetic" : "private",
    });
  }
  return candidates;
}

type BuilderModelResourceDependencies = {
  readonly createObjectUrlLease: (
    blob: Blob,
    signal: AbortSignal,
  ) => AbortBoundObjectUrl | null;
  readonly createSyntheticModelBytes: () => Uint8Array;
  readonly fetchPrivateModel: (
    signal: AbortSignal,
    workspaceId: string,
    assetId: string,
  ) => Promise<Blob>;
};

const defaultDependencies: BuilderModelResourceDependencies = {
  createObjectUrlLease: createAbortBoundObjectUrl,
  createSyntheticModelBytes: createSyntheticDraftGlb,
  fetchPrivateModel: (signal, workspaceId, assetId) =>
    fetchAssetFileBlob(signal, workspaceId, assetId, "model"),
};

type LoadBuilderModelResourcesInput = {
  readonly candidates: readonly BuilderModelCandidate[];
  readonly dependencies?: BuilderModelResourceDependencies;
  readonly signal: AbortSignal;
  readonly workspaceId: string;
};

export type LoadedBuilderModelResources = {
  readonly failedCount: number;
  readonly models: readonly BuilderModelResource[];
  release(): void;
};

function syntheticModelBlob(bytes: Uint8Array): Blob {
  return new Blob(
    [
      bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer,
    ],
    { type: assetModelContentType },
  );
}

export async function loadBuilderModelResources({
  candidates,
  dependencies = defaultDependencies,
  signal,
  workspaceId,
}: LoadBuilderModelResourcesInput): Promise<LoadedBuilderModelResources> {
  const leases: AbortBoundObjectUrl[] = [];
  const release = () => {
    for (const lease of leases) lease.revoke();
  };
  const loaded = await Promise.all(
    candidates.slice(0, 9).map(async (candidate) => {
      try {
        const blob =
          candidate.source === "local-synthetic"
            ? syntheticModelBlob(dependencies.createSyntheticModelBytes())
            : await dependencies.fetchPrivateModel(
                signal,
                workspaceId,
                candidate.assetId,
              );
        const lease = dependencies.createObjectUrlLease(blob, signal);
        if (!lease) return null;
        leases.push(lease);
        return { key: candidate.key, url: lease.url };
      } catch {
        return null;
      }
    }),
  );

  if (signal.aborted) {
    release();
    return { failedCount: candidates.length, models: [], release };
  }

  const models = loaded.filter(
    (resource): resource is BuilderModelResource => resource !== null,
  );
  return {
    failedCount: Math.max(candidates.length - models.length, 0),
    models,
    release,
  };
}
