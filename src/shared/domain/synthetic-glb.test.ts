import { describe, expect, it } from "vitest";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import { validateAssetFileBytes } from "./asset-files";
import { createSyntheticDraftGlb } from "./synthetic-glb";

describe("synthetic GLB fixture", () => {
  it("creates a bounded self-contained glTF 2.0 draft at runtime", () => {
    const bytes = createSyntheticDraftGlb();

    expect(bytes.byteLength).toBeGreaterThan(100);
    expect(bytes.byteLength).toBeLessThan(10_000);
    expect(validateAssetFileBytes("model", "model/gltf-binary", bytes)).toBe(
      "model/gltf-binary",
    );
  });

  it("can be decoded by the same loader used in the review viewport", async () => {
    const bytes = createSyntheticDraftGlb();
    const buffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    const gltf = await new GLTFLoader().parseAsync(buffer, "");

    expect(gltf.scene.children).toHaveLength(1);
  });
});
