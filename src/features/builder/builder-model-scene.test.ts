import { describe, expect, it, vi } from "vitest";

import { catalogParts, currentBuild } from "../../shared/domain/mockData";
import type { CatalogPart } from "../../shared/domain/schemas";
import {
  loadBuilderModelResources,
  selectBuilderModelCandidates,
  type BuilderModelCandidate,
} from "./builder-model-scene";

const selectedParts = catalogParts.filter((part) =>
  currentBuild.selectedPartIds.includes(part.id),
);

function candidate(
  category: BuilderModelCandidate["category"],
  source: BuilderModelCandidate["source"] = "private",
): BuilderModelCandidate {
  return {
    assetId: `asset-${category}-fixture`,
    category,
    key: category,
    source,
  };
}

describe("Builder multi-model scene", () => {
  it("selects only approved selected models in canonical category order", () => {
    const candidates = selectBuilderModelCandidates({
      isLocalPreview: false,
      selectedCategory: "summary",
      selectedParts,
    });

    expect(candidates.map((item) => item.category)).toEqual([
      "case",
      "motherboard",
      "gpu",
      "memory",
    ]);
    expect(candidates.every((item) => item.source === "private")).toBe(true);
    expect(candidates.every((item) => item.key === item.category)).toBe(true);
  });

  it("keeps a category view scoped to its one selected approved model", () => {
    const gpu = selectBuilderModelCandidates({
      isLocalPreview: false,
      selectedCategory: "gpu",
      selectedParts,
    });
    const cpu = selectBuilderModelCandidates({
      isLocalPreview: false,
      selectedCategory: "cpu",
      selectedParts,
    });

    expect(gpu.map((item) => item.category)).toEqual(["gpu"]);
    expect(cpu).toEqual([]);
  });

  it("uses synthetic fixture GLBs for approved models only in local preview", () => {
    const candidates = selectBuilderModelCandidates({
      isLocalPreview: true,
      selectedCategory: "summary",
      selectedParts,
    });

    expect(candidates).toHaveLength(4);
    expect(candidates.every((item) => item.source === "local-synthetic")).toBe(
      true,
    );
  });

  it("deduplicates malformed duplicate categories and caps the scene at nine", () => {
    const approved = selectedParts.find(
      (part) => part.category === "gpu",
    ) as CatalogPart;
    const duplicates = Array.from({ length: 12 }, (_, index) => ({
      ...approved,
      id: `part-duplicate-${index}`,
      assetId: `asset-duplicate-${index}`,
      category: index % 2 === 0 ? ("gpu" as const) : ("case" as const),
    }));

    const candidates = selectBuilderModelCandidates({
      isLocalPreview: false,
      selectedCategory: "summary",
      selectedParts: duplicates,
    });

    expect(candidates.map((item) => item.category)).toEqual(["case", "gpu"]);
    expect(candidates.length).toBeLessThanOrEqual(9);
  });

  it("loads independent private models in parallel and preserves partial success", async () => {
    const pending = new Map<
      string,
      { reject(reason: Error): void; resolve(value: Blob): void }
    >();
    const fetchPrivateModel = vi.fn(
      (_signal: AbortSignal, _workspaceId: string, assetId: string) =>
        new Promise<Blob>((resolve, reject) => {
          pending.set(assetId, { reject, resolve });
        }),
    );
    const revoked: string[] = [];
    let objectUrlSequence = 0;
    const createObjectUrlLease = vi.fn(() => {
      const url = `blob:builder-scene-${objectUrlSequence++}`;
      let released = false;
      return {
        url,
        revoke() {
          if (!released) revoked.push(url);
          released = true;
        },
      };
    });
    const controller = new AbortController();
    const loading = loadBuilderModelResources({
      candidates: [candidate("case"), candidate("gpu")],
      dependencies: {
        createObjectUrlLease,
        createSyntheticModelBytes: () => new Uint8Array([0x01]),
        fetchPrivateModel,
      },
      signal: controller.signal,
      workspaceId: "workspace-scene-fixture",
    });

    await Promise.resolve();
    expect(fetchPrivateModel).toHaveBeenCalledTimes(2);
    pending
      .get("asset-case-fixture")
      ?.resolve(new Blob([new Uint8Array([0x01])]));
    pending
      .get("asset-gpu-fixture")
      ?.reject(new Error("synthetic private read failure"));

    const loaded = await loading;
    expect(loaded.models).toEqual([
      { key: "case", url: "blob:builder-scene-0" },
    ]);
    expect(loaded.failedCount).toBe(1);
    loaded.release();
    loaded.release();
    expect(revoked).toEqual(["blob:builder-scene-0"]);
  });

  it("creates local fixture resources without a private request", async () => {
    const fetchPrivateModel = vi.fn();
    const controller = new AbortController();
    const loaded = await loadBuilderModelResources({
      candidates: [candidate("motherboard", "local-synthetic")],
      dependencies: {
        createObjectUrlLease: () => ({
          url: "blob:local-builder-fixture",
          revoke() {},
        }),
        createSyntheticModelBytes: () => new Uint8Array([0x67, 0x6c, 0x54]),
        fetchPrivateModel,
      },
      signal: controller.signal,
      workspaceId: "workspace-local-fixture",
    });

    expect(fetchPrivateModel).not.toHaveBeenCalled();
    expect(loaded.models).toEqual([
      { key: "motherboard", url: "blob:local-builder-fixture" },
    ]);
    expect(loaded.failedCount).toBe(0);
  });

  it("releases every late URL when the scene scope is cancelled", async () => {
    let hasPrivateResolver = false;
    let resolvePrivateModel: (value: Blob) => void = () => {
      throw new Error("private model resolver was not initialized");
    };
    const revoked: string[] = [];
    const controller = new AbortController();
    const loading = loadBuilderModelResources({
      candidates: [candidate("case")],
      dependencies: {
        createObjectUrlLease: () => ({
          url: "blob:late-private-builder-model",
          revoke() {
            revoked.push("blob:late-private-builder-model");
          },
        }),
        createSyntheticModelBytes: () => new Uint8Array([0x01]),
        fetchPrivateModel: () =>
          new Promise<Blob>((resolve) => {
            hasPrivateResolver = true;
            resolvePrivateModel = resolve;
          }),
      },
      signal: controller.signal,
      workspaceId: "workspace-cancelled-scene",
    });

    await Promise.resolve();
    controller.abort();
    expect(hasPrivateResolver).toBe(true);
    resolvePrivateModel(new Blob([new Uint8Array([0x02])]));

    const loaded = await loading;
    expect(loaded.models).toEqual([]);
    expect(loaded.failedCount).toBe(1);
    expect(revoked).toEqual(["blob:late-private-builder-model"]);
  });
});
