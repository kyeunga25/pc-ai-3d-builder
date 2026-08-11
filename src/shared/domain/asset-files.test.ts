import { describe, expect, it } from "vitest";

import {
  AssetFileValidationError,
  validateAssetFileBytes,
} from "./asset-files";
import {
  createAlternateSyntheticSourcePng,
  createSyntheticSourcePng,
} from "./synthetic-image";
import { createSyntheticDraftGlb } from "./synthetic-glb";

const pngCrcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  let current = value;
  for (let bit = 0; bit < 8; bit += 1) {
    current =
      (current & 1) === 1 ? 0xedb88320 ^ (current >>> 1) : current >>> 1;
  }
  return current >>> 0;
});

function pngCrc32(bytes: Uint8Array, start: number, end: number): number {
  let crc = 0xffffffff;
  for (let index = start; index < end; index += 1) {
    crc = pngCrcTable[(crc ^ bytes[index]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngWithChunk(type: string, data: Uint8Array): Uint8Array {
  const source = createSyntheticSourcePng();
  const insertAt = 33;
  const chunk = new Uint8Array(12 + data.byteLength);
  const chunkView = new DataView(chunk.buffer);
  chunkView.setUint32(0, data.byteLength, false);
  chunk.set(new TextEncoder().encode(type), 4);
  chunk.set(data, 8);
  chunkView.setUint32(
    8 + data.byteLength,
    pngCrc32(chunk, 4, 8 + data.byteLength),
    false,
  );
  const result = new Uint8Array(source.byteLength + chunk.byteLength);
  result.set(source.subarray(0, insertAt));
  result.set(chunk, insertAt);
  result.set(source.subarray(insertAt), insertAt + chunk.byteLength);
  return result;
}

function pngWithDimensions(width: number, height: number): Uint8Array {
  const png = createSyntheticSourcePng();
  const view = new DataView(png.buffer);
  view.setUint32(16, width, false);
  view.setUint32(20, height, false);
  view.setUint32(29, pngCrc32(png, 12, 29), false);
  return png;
}

function structuralJpeg(): Uint8Array {
  return new Uint8Array([
    0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01,
    0x01, 0x11, 0x00, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
    0x00, 0x00, 0xff, 0xd9,
  ]);
}

function structuralWebp(): Uint8Array {
  return new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x12, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    0x56, 0x50, 0x38, 0x4c, 0x05, 0x00, 0x00, 0x00, 0x2f, 0x00, 0x00, 0x00,
    0x00, 0x00,
  ]);
}

function incompleteAnimatedWebp(): Uint8Array {
  const bytes = new Uint8Array(68);
  bytes.set([0x52, 0x49, 0x46, 0x46]);
  new DataView(bytes.buffer).setUint32(4, bytes.byteLength - 8, true);
  bytes.set([0x57, 0x45, 0x42, 0x50], 8);
  bytes.set([0x56, 0x50, 0x38, 0x58], 12);
  new DataView(bytes.buffer).setUint32(16, 10, true);
  bytes[20] = 0x02;
  bytes.set([0x41, 0x4e, 0x49, 0x4d], 30);
  new DataView(bytes.buffer).setUint32(34, 6, true);
  bytes.set([0x41, 0x4e, 0x4d, 0x46], 44);
  new DataView(bytes.buffer).setUint32(48, 16, true);
  return bytes;
}

function writeUint24Le(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >> 8) & 0xff;
  bytes[offset + 2] = (value >> 16) & 0xff;
}

function animatedWebp(frameCount: number, width = 1, height = 1): Uint8Array {
  const frameSize = 38;
  const bytes = new Uint8Array(44 + frameCount * frameSize);
  const view = new DataView(bytes.buffer);
  bytes.set([0x52, 0x49, 0x46, 0x46]);
  view.setUint32(4, bytes.byteLength - 8, true);
  bytes.set([0x57, 0x45, 0x42, 0x50], 8);
  bytes.set([0x56, 0x50, 0x38, 0x58], 12);
  view.setUint32(16, 10, true);
  bytes[20] = 0x02;
  writeUint24Le(bytes, 24, width - 1);
  writeUint24Le(bytes, 27, height - 1);
  bytes.set([0x41, 0x4e, 0x49, 0x4d], 30);
  view.setUint32(34, 6, true);
  for (let frame = 0; frame < frameCount; frame += 1) {
    const cursor = 44 + frame * frameSize;
    bytes.set([0x41, 0x4e, 0x4d, 0x46], cursor);
    view.setUint32(cursor + 4, 30, true);
    writeUint24Le(bytes, cursor + 14, width - 1);
    writeUint24Le(bytes, cursor + 17, height - 1);
    bytes.set([0x56, 0x50, 0x38, 0x4c], cursor + 24);
    view.setUint32(cursor + 28, 5, true);
    bytes[cursor + 32] = 0x2f;
    view.setUint32(cursor + 33, (width - 1) | ((height - 1) << 14), true);
  }
  return bytes;
}

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
  it.each([
    [
      "source size",
      () => validateAssetFileBytes("source", "image/png", new Uint8Array()),
    ],
    [
      "model media type",
      () => validateAssetFileBytes("model", "text/plain", minimalGlb()),
    ],
    [
      "GLB structure",
      () => {
        const glb = minimalGlb();
        new DataView(glb.buffer).setUint32(8, glb.byteLength + 4, true);
        return validateAssetFileBytes("model", "model/gltf-binary", glb);
      },
    ],
  ])("returns bilingual public validation copy for %s", (_label, validate) => {
    expect(validate).toThrowError(
      expect.objectContaining({
        message: expect.stringMatching(/[一-龥].+ \/ .+[A-Za-z]/u),
      }),
    );
  });

  it("accepts bounded PNG, JPEG and WebP containers with matching MIME", () => {
    const png = createSyntheticSourcePng();

    expect(validateAssetFileBytes("source", "image/png", png)).toBe(
      "image/png",
    );
    expect(
      validateAssetFileBytes(
        "source",
        "image/png",
        createAlternateSyntheticSourcePng(),
      ),
    ).toBe("image/png");
    expect(
      validateAssetFileBytes("source", "image/jpeg", structuralJpeg()),
    ).toBe("image/jpeg");
    expect(
      validateAssetFileBytes("source", "image/webp", structuralWebp()),
    ).toBe("image/webp");
    expect(() => validateAssetFileBytes("source", "image/jpeg", png)).toThrow(
      AssetFileValidationError,
    );
  });

  it("rejects animated sources and images above the browser decode budget", () => {
    const animationControl = new Uint8Array(8);
    new DataView(animationControl.buffer).setUint32(0, 1, false);

    expect(() =>
      validateAssetFileBytes(
        "source",
        "image/png",
        pngWithChunk("acTL", animationControl),
      ),
    ).toThrow(AssetFileValidationError);
    expect(() =>
      validateAssetFileBytes("source", "image/webp", animatedWebp(1)),
    ).toThrow(AssetFileValidationError);
    expect(() =>
      validateAssetFileBytes(
        "source",
        "image/png",
        pngWithDimensions(6_000, 4_001),
      ),
    ).toThrow(AssetFileValidationError);
  });

  it("rejects signature-only, truncated and checksum-corrupted images", () => {
    const signatureOnlyPng = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    expect(() =>
      validateAssetFileBytes("source", "image/png", signatureOnlyPng),
    ).toThrow(AssetFileValidationError);

    const corruptedPng = createSyntheticSourcePng();
    const finalByte = corruptedPng.byteLength - 1;
    corruptedPng[finalByte] = corruptedPng[finalByte]! ^ 1;
    expect(() =>
      validateAssetFileBytes("source", "image/png", corruptedPng),
    ).toThrow(AssetFileValidationError);

    expect(() =>
      validateAssetFileBytes(
        "source",
        "image/jpeg",
        new Uint8Array([0xff, 0xd8, 0xff]),
      ),
    ).toThrow(AssetFileValidationError);
    expect(() =>
      validateAssetFileBytes(
        "source",
        "image/webp",
        structuralWebp().slice(0, 12),
      ),
    ).toThrow(AssetFileValidationError);
  });

  it("rejects unsafe WebP dimensions, non-zero padding and empty animation frames", () => {
    const oversized = structuralWebp();
    oversized.set([0xff, 0xff, 0xff, 0xff], 22);
    expect(() =>
      validateAssetFileBytes("source", "image/webp", oversized),
    ).toThrow(AssetFileValidationError);

    const nonZeroPadding = structuralWebp();
    nonZeroPadding[nonZeroPadding.byteLength - 1] = 1;
    expect(() =>
      validateAssetFileBytes("source", "image/webp", nonZeroPadding),
    ).toThrow(AssetFileValidationError);

    expect(() =>
      validateAssetFileBytes("source", "image/webp", incompleteAnimatedWebp()),
    ).toThrow(AssetFileValidationError);
    expect(() =>
      validateAssetFileBytes("source", "image/webp", animatedWebp(121)),
    ).toThrow(AssetFileValidationError);
    expect(() =>
      validateAssetFileBytes(
        "source",
        "image/webp",
        animatedWebp(101, 1000, 1000),
      ),
    ).toThrow(AssetFileValidationError);
  });

  it("accepts a complete glTF 2.0 GLB and rejects length tampering", () => {
    const glb = createSyntheticDraftGlb();
    expect(
      validateAssetFileBytes("model", "application/octet-stream", glb),
    ).toBe("model/gltf-binary");

    new DataView(glb.buffer).setUint32(8, glb.byteLength + 4, true);
    expect(() =>
      validateAssetFileBytes("model", "model/gltf-binary", glb),
    ).toThrow(AssetFileValidationError);
  });

  it("rejects external resources and GLBs without bounded renderable geometry", () => {
    const external = minimalGlb({
      buffers: [{ byteLength: 4, uri: "https://example.com/model.bin" }],
    });
    expect(() =>
      validateAssetFileBytes("model", "model/gltf-binary", external),
    ).toThrow(AssetFileValidationError);

    const unboundedAccessor = minimalGlb({
      scenes: [{ nodes: [0] }],
      nodes: [{ mesh: 0 }],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
      accessors: [
        {
          componentType: 5126,
          count: 100_000_000,
          type: "VEC3",
          min: [0, 0, 0],
          max: [1, 1, 1],
        },
      ],
    });
    expect(() =>
      validateAssetFileBytes("model", "model/gltf-binary", unboundedAccessor),
    ).toThrow(AssetFileValidationError);
  });
});
