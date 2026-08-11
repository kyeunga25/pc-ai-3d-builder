import { describe, expect, it } from "vitest";

import { generationOutputRequirements } from "../../worker/generation/provider";
import {
  GlbValidationError,
  validateGeneratedGlb,
  type GlbSafetyPolicy,
} from "./glb-validation";
import { createSyntheticDraftGlb } from "./synthetic-glb";
import { createSyntheticSourcePng } from "./synthetic-image";

type JsonRecord = Record<string, unknown>;

function align4(value: number): number {
  return Math.ceil(value / 4) * 4;
}

function rewriteSyntheticGlb(
  mutate: (document: JsonRecord) => void,
): Uint8Array {
  const original = createSyntheticDraftGlb();
  const originalView = new DataView(original.buffer);
  const originalJsonLength = originalView.getUint32(12, true);
  const binaryHeaderOffset = 20 + originalJsonLength;
  const binaryLength = originalView.getUint32(binaryHeaderOffset, true);
  const binary = original.slice(
    binaryHeaderOffset + 8,
    binaryHeaderOffset + 8 + binaryLength,
  );
  const document = JSON.parse(
    new TextDecoder()
      .decode(original.subarray(20, 20 + originalJsonLength))
      .trimEnd(),
  ) as JsonRecord;
  mutate(document);

  const rawJson = new TextEncoder().encode(JSON.stringify(document));
  const jsonLength = align4(rawJson.byteLength);
  const totalLength = 12 + 8 + jsonLength + 8 + binaryLength;
  const rewritten = new Uint8Array(totalLength);
  const view = new DataView(rewritten.buffer);
  rewritten.set([0x67, 0x6c, 0x54, 0x46]);
  view.setUint32(4, 2, true);
  view.setUint32(8, totalLength, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  rewritten.fill(0x20, 20, 20 + jsonLength);
  rewritten.set(rawJson, 20);
  const nextBinaryHeader = 20 + jsonLength;
  view.setUint32(nextBinaryHeader, binaryLength, true);
  view.setUint32(nextBinaryHeader + 4, 0x004e4942, true);
  rewritten.set(binary, nextBinaryHeader + 8);
  return rewritten;
}

function expectValidationCode(
  bytes: Uint8Array,
  code: GlbValidationError["code"],
  policy: GlbSafetyPolicy = generationOutputRequirements,
): void {
  try {
    validateGeneratedGlb(bytes, policy);
    throw new Error("Expected GLB validation to fail.");
  } catch (error) {
    expect(error).toBeInstanceOf(GlbValidationError);
    expect((error as GlbValidationError).code).toBe(code);
  }
}

describe("generated GLB safety policy", () => {
  it("reports bounded geometry for the synthetic fixture", () => {
    expect(
      validateGeneratedGlb(
        createSyntheticDraftGlb(),
        generationOutputRequirements,
      ),
    ).toEqual({
      dimensionMm: 1733,
      textureBytes: 0,
      textureCount: 0,
      triangleCount: 12,
    });
  });

  it("rejects oversized geometry including nested node scale", () => {
    const oversized = rewriteSyntheticGlb((document) => {
      const accessors = document.accessors as JsonRecord[];
      accessors[0]!.max = [20, 0.5, 0.5];
    });
    expectValidationCode(oversized, "GLB_DIMENSIONS_EXCEEDED");

    const scaled = rewriteSyntheticGlb((document) => {
      document.nodes = [
        { children: [1], scale: [10, 10, 10] },
        { mesh: 0, scale: [10, 10, 10] },
      ];
    });
    expectValidationCode(scaled, "GLB_DIMENSIONS_EXCEEDED");
  });

  it("enforces triangle and texture limits before staging", () => {
    expectValidationCode(
      createSyntheticDraftGlb(),
      "GLB_POLYGON_LIMIT_EXCEEDED",
      { ...generationOutputRequirements, maxTriangles: 11 },
    );

    const textured = rewriteSyntheticGlb((document) => {
      document.images = Array.from({ length: 17 }, () => ({
        uri: "data:image/png;base64,AA==",
      }));
      document.textures = Array.from({ length: 17 }, (_, source) => ({
        source,
      }));
    });
    expectValidationCode(textured, "GLB_TEXTURE_LIMIT_EXCEEDED");

    expectValidationCode(createSyntheticDraftGlb(), "GLB_STRUCTURE_INVALID", {
      ...generationOutputRequirements,
      maxDecodedGeometryBytes: 1,
    });
  });

  it("validates embedded texture bytes instead of trusting their MIME", () => {
    const png = createSyntheticSourcePng();
    const encodedPng = btoa(String.fromCharCode(...png));
    const validTexture = rewriteSyntheticGlb((document) => {
      document.images = [{ uri: `data:image/png;base64,${encodedPng}` }];
      document.textures = [{ source: 0 }];
    });
    expect(
      validateGeneratedGlb(validTexture, generationOutputRequirements),
    ).toMatchObject({ textureBytes: png.byteLength, textureCount: 1 });

    const invalidTexture = rewriteSyntheticGlb((document) => {
      document.images = [{ uri: "data:image/png;base64,AA==" }];
      document.textures = [{ source: 0 }];
    });
    expectValidationCode(invalidTexture, "GLB_STRUCTURE_INVALID");
  });

  it("rejects malformed index accessors instead of treating them as unindexed", () => {
    const malformed = rewriteSyntheticGlb((document) => {
      const meshes = document.meshes as Array<{ primitives: JsonRecord[] }>;
      meshes[0]!.primitives[0]!.indices = "2";
    });
    expectValidationCode(malformed, "GLB_STRUCTURE_INVALID");
  });
});
