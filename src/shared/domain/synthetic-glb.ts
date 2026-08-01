const positions = [
  // Front
  -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
  // Back
  0.5, -0.5, -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5,
  // Right
  0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5,
  // Left
  -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5,
  // Top
  -0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5,
  // Bottom
  -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5,
] as const;

const normals = [
  0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 1,
  0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 1,
  0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
] as const;

const indices = [
  0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14,
  15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23,
] as const;

function align4(value: number): number {
  return Math.ceil(value / 4) * 4;
}

function writeFloat32Values(
  view: DataView,
  byteOffset: number,
  values: readonly number[],
): number {
  values.forEach((value, index) =>
    view.setFloat32(byteOffset + index * 4, value, true),
  );
  return values.length * 4;
}

function writeUint16Values(
  view: DataView,
  byteOffset: number,
  values: readonly number[],
): number {
  values.forEach((value, index) =>
    view.setUint16(byteOffset + index * 2, value, true),
  );
  return values.length * 2;
}

export function createSyntheticDraftGlb(): Uint8Array {
  if (positions.length !== normals.length || positions.length % 3 !== 0) {
    throw new Error("Synthetic GLB vertex attributes are inconsistent.");
  }

  const vertexCount = positions.length / 3;
  const positionBytes = positions.length * 4;
  const normalBytes = normals.length * 4;
  const indexBytes = indices.length * 2;
  const binaryLength = align4(positionBytes + normalBytes + indexBytes);
  const binary = new Uint8Array(binaryLength);
  const binaryView = new DataView(binary.buffer);
  let offset = 0;
  offset += writeFloat32Values(binaryView, offset, positions);
  offset += writeFloat32Values(binaryView, offset, normals);
  writeUint16Values(binaryView, offset, indices);

  const document = {
    asset: { version: "2.0", generator: "RigStage synthetic adapter" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: "Synthetic review draft" }],
    meshes: [
      {
        primitives: [
          {
            attributes: { POSITION: 0, NORMAL: 1 },
            indices: 2,
            material: 0,
          },
        ],
      },
    ],
    materials: [
      {
        pbrMetallicRoughness: {
          baseColorFactor: [0.16, 0.52, 0.72, 1],
          metallicFactor: 0.15,
          roughnessFactor: 0.58,
        },
      },
    ],
    buffers: [{ byteLength: binaryLength }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: positionBytes, target: 34962 },
      {
        buffer: 0,
        byteOffset: positionBytes,
        byteLength: normalBytes,
        target: 34962,
      },
      {
        buffer: 0,
        byteOffset: positionBytes + normalBytes,
        byteLength: indexBytes,
        target: 34963,
      },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: vertexCount,
        type: "VEC3",
        min: [-0.5, -0.5, -0.5],
        max: [0.5, 0.5, 0.5],
      },
      {
        bufferView: 1,
        componentType: 5126,
        count: vertexCount,
        type: "VEC3",
      },
      { bufferView: 2, componentType: 5123, count: 36, type: "SCALAR" },
    ],
  };
  const rawJson = new TextEncoder().encode(JSON.stringify(document));
  const jsonLength = align4(rawJson.byteLength);
  const totalLength = 12 + 8 + jsonLength + 8 + binaryLength;
  const glb = new Uint8Array(totalLength);
  const view = new DataView(glb.buffer);
  glb.set([0x67, 0x6c, 0x54, 0x46], 0);
  view.setUint32(4, 2, true);
  view.setUint32(8, totalLength, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  glb.fill(0x20, 20, 20 + jsonLength);
  glb.set(rawJson, 20);
  const binaryHeaderOffset = 20 + jsonLength;
  view.setUint32(binaryHeaderOffset, binaryLength, true);
  view.setUint32(binaryHeaderOffset + 4, 0x004e4942, true);
  glb.set(binary, binaryHeaderOffset + 8);
  return glb;
}
