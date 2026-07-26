import { describe, expect, it } from "vitest";

import {
  AssetFileValidationError,
  validateAssetFileBytes,
} from "./asset-files";

function minimalGlb(extra: Record<string, unknown> = {}): Uint8Array {
  const rawJson = new TextEncoder().encode(
    JSON.stringify({
      asset: { version: "2.0" },
      scenes: [{}],
      scene: 0,
      ...extra,
    }),
  );
  const paddedLength = Math.ceil(rawJson.byteLength / 4) * 4;
  const bytes = new Uint8Array(20 + paddedLength);
  bytes.set([0x67, 0x6c, 0x54, 0x46]);
  const view = new DataView(bytes.buffer);
  view.setUint32(4, 2, true);
  view.setUint32(8, bytes.byteLength, true);
  view.setUint32(12, paddedLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  bytes.fill(0x20, 20);
  bytes.set(rawJson, 20);
  return bytes;
}

describe("asset file validation", () => {
  it("matches image MIME types to their binary signatures", () => {
    const png = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);

    expect(validateAssetFileBytes("source", "image/png", png)).toBe(
      "image/png",
    );
    expect(() => validateAssetFileBytes("source", "image/jpeg", png)).toThrow(
      AssetFileValidationError,
    );
  });

  it("accepts a complete glTF 2.0 GLB and rejects length tampering", () => {
    const glb = minimalGlb();
    expect(
      validateAssetFileBytes("model", "application/octet-stream", glb),
    ).toBe("model/gltf-binary");

    new DataView(glb.buffer).setUint32(8, glb.byteLength + 4, true);
    expect(() =>
      validateAssetFileBytes("model", "model/gltf-binary", glb),
    ).toThrow(AssetFileValidationError);
  });

  it("rejects external resources but accepts embedded data URIs", () => {
    const external = minimalGlb({
      buffers: [{ byteLength: 4, uri: "https://example.com/model.bin" }],
    });
    expect(() =>
      validateAssetFileBytes("model", "model/gltf-binary", external),
    ).toThrow(AssetFileValidationError);

    const embedded = minimalGlb({
      buffers: [
        {
          byteLength: 4,
          uri: "data:application/octet-stream;base64,AAAAAA==",
        },
      ],
    });
    expect(validateAssetFileBytes("model", "model/gltf-binary", embedded)).toBe(
      "model/gltf-binary",
    );
  });
});
