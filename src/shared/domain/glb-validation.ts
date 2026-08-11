import { validateImageStructure } from "./image-validation";

export type GlbSafetyPolicy = {
  maxBytes: number;
  maxDecodedGeometryBytes: number;
  maxDimensionMm: number;
  maxNodes: number;
  maxPrimitives: number;
  maxTriangles: number;
  maxTextures: number;
  maxTextureBytes: number;
  selfContained: true;
};

export type GlbValidationReport = {
  dimensionMm: number;
  textureBytes: number;
  textureCount: number;
  triangleCount: number;
};

export const rigStageGlbSafetyPolicy = {
  maxBytes: 25 * 1024 * 1024,
  maxDecodedGeometryBytes: 64 * 1024 * 1024,
  maxDimensionMm: 10_000,
  maxNodes: 4_096,
  maxPrimitives: 4_096,
  maxTriangles: 500_000,
  maxTextures: 16,
  maxTextureBytes: 16 * 1024 * 1024,
  selfContained: true,
} as const satisfies GlbSafetyPolicy;

export class GlbValidationError extends Error {
  constructor(
    readonly code:
      | "GLB_DIMENSIONS_EXCEEDED"
      | "GLB_EXTERNAL_URI"
      | "GLB_HEADER_INVALID"
      | "GLB_LENGTH_MISMATCH"
      | "GLB_POLYGON_LIMIT_EXCEEDED"
      | "GLB_STRUCTURE_INVALID"
      | "GLB_TEXTURE_LIMIT_EXCEEDED",
    message: string,
  ) {
    super(message);
    this.name = "GlbValidationError";
  }
}

type JsonRecord = Record<string, unknown>;

type ParsedGlb = {
  binary: Uint8Array | null;
  document: JsonRecord;
};

const jsonChunkType = 0x4e4f534a;
const binaryChunkType = 0x004e4942;
const maxJsonChunkBytes = 2 * 1024 * 1024;
const maxStructuralItems = 4096;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function recordArray(value: unknown, label: string): JsonRecord[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || value.some((item) => !isRecord(item))) {
    throw structureError(`${label} 結構無效。`);
  }
  if (value.length > maxStructuralItems) {
    throw structureError(`${label} 數量超出安全限制。`);
  }
  return value;
}

function integer(value: unknown, minimum = 0): number | null {
  return Number.isSafeInteger(value) && Number(value) >= minimum
    ? Number(value)
    : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function structureError(
  message = "GLB 的 glTF 結構無效。",
): GlbValidationError {
  return new GlbValidationError("GLB_STRUCTURE_INVALID", message);
}

function parseGlb(bytes: Uint8Array): ParsedGlb {
  if (
    bytes.byteLength < 20 ||
    bytes[0] !== 0x67 ||
    bytes[1] !== 0x6c ||
    bytes[2] !== 0x54 ||
    bytes[3] !== 0x46
  ) {
    throw new GlbValidationError("GLB_HEADER_INVALID", "GLB 檔頭無效。");
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(4, true) !== 2) {
    throw new GlbValidationError("GLB_HEADER_INVALID", "只接受 glTF 2.0 GLB。");
  }
  if (view.getUint32(8, true) !== bytes.byteLength) {
    throw new GlbValidationError(
      "GLB_LENGTH_MISMATCH",
      "GLB 宣告長度與實際檔案不一致。",
    );
  }

  let offset = 12;
  let rawJson: Uint8Array | null = null;
  let binary: Uint8Array | null = null;
  let hasBinaryChunk = false;
  let chunkIndex = 0;
  while (offset < bytes.byteLength) {
    if (offset + 8 > bytes.byteLength) {
      throw new GlbValidationError(
        "GLB_LENGTH_MISMATCH",
        "GLB chunk header 不完整。",
      );
    }
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (length % 4 !== 0 || dataEnd > bytes.byteLength) {
      throw new GlbValidationError(
        "GLB_LENGTH_MISMATCH",
        "GLB chunk 長度無效。",
      );
    }
    if (chunkIndex === 0 && type !== jsonChunkType) {
      throw structureError("GLB 第一個 chunk 必須是 JSON。");
    }
    if (type === jsonChunkType) {
      if (rawJson || length === 0 || length > maxJsonChunkBytes) {
        throw structureError("GLB JSON chunk 無效或過大。");
      }
      rawJson = bytes.subarray(dataStart, dataEnd);
    } else if (type === binaryChunkType) {
      if (hasBinaryChunk) {
        throw structureError("GLB 只可包含一個 binary chunk。");
      }
      hasBinaryChunk = true;
      binary = bytes.subarray(dataStart, dataEnd);
    } else {
      throw structureError("GLB 包含不支援的 chunk 類型。");
    }
    offset = dataEnd;
    chunkIndex += 1;
  }

  if (!rawJson || offset !== bytes.byteLength) {
    throw new GlbValidationError(
      "GLB_LENGTH_MISMATCH",
      "GLB chunk 未完整對齊檔案長度。",
    );
  }

  let document: unknown;
  try {
    document = JSON.parse(
      new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(
        rawJson,
      ),
    ) as unknown;
  } catch {
    throw structureError("GLB JSON 無法解碼。");
  }
  if (
    !isRecord(document) ||
    !isRecord(document.asset) ||
    document.asset.version !== "2.0"
  ) {
    throw structureError("GLB 未宣告有效的 glTF 2.0 asset。");
  }

  return { binary, document };
}

function assertSelfContained(document: JsonRecord): void {
  const pending: unknown[] = [document];
  let inspected = 0;
  while (pending.length > 0) {
    const value = pending.pop();
    inspected += 1;
    if (inspected > 50_000) {
      throw structureError("GLB JSON 結構過於複雜。");
    }
    if (Array.isArray(value)) {
      pending.push(...value);
      continue;
    }
    if (!isRecord(value)) {
      continue;
    }
    for (const [key, child] of Object.entries(value)) {
      if (
        key === "uri" &&
        (typeof child !== "string" || !child.toLowerCase().startsWith("data:"))
      ) {
        throw new GlbValidationError(
          "GLB_EXTERNAL_URI",
          "GLB 必須自包含，不可引用外部檔案。",
        );
      }
      pending.push(child);
    }
  }
}

function decodeDataUri(
  uri: string,
  allowedMimeTypes?: readonly string[],
): { bytes: Uint8Array; mimeType: string } {
  const comma = uri.indexOf(",");
  const descriptor = comma < 0 ? "" : uri.slice(5, comma).toLowerCase();
  const mimeType = descriptor.split(";")[0] ?? "";
  if (
    !uri.toLowerCase().startsWith("data:") ||
    comma < 0 ||
    !descriptor.endsWith(";base64") ||
    (allowedMimeTypes && !allowedMimeTypes.includes(mimeType))
  ) {
    throw structureError("內嵌圖片必須使用 base64 data URI。");
  }
  const payload = uri.slice(comma + 1).replace(/\s/gu, "");
  if (!/^[A-Za-z0-9+/]*={0,2}$/u.test(payload) || payload.length % 4 !== 0) {
    throw structureError("內嵌圖片 data URI 無效。");
  }
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  const decodedLength = (payload.length / 4) * 3 - padding;
  if (decodedLength > rigStageGlbSafetyPolicy.maxBytes) {
    throw structureError("內嵌 data URI 超出安全限制。");
  }
  let decoded: string;
  try {
    decoded = atob(payload);
  } catch {
    throw structureError("內嵌 data URI 無法解碼。");
  }
  if (decoded.length !== decodedLength) {
    throw structureError("內嵌 data URI 長度不一致。");
  }
  return {
    bytes: Uint8Array.from(decoded, (value) => value.charCodeAt(0)),
    mimeType,
  };
}

function validateEmbeddedImage(
  bytes: Uint8Array,
  declaredMimeType: string,
): void {
  let inferredMimeType: string;
  try {
    inferredMimeType = validateImageStructure(bytes);
  } catch {
    throw structureError("GLB 內嵌貼圖結構無效或超出安全限制。");
  }
  if (inferredMimeType !== declaredMimeType) {
    throw structureError("GLB 內嵌貼圖 MIME 與檔案內容不一致。");
  }
}

function componentBytes(componentType: number): number | null {
  switch (componentType) {
    case 5120:
    case 5121:
      return 1;
    case 5122:
    case 5123:
      return 2;
    case 5125:
    case 5126:
      return 4;
    default:
      return null;
  }
}

function componentCount(type: unknown): number | null {
  switch (type) {
    case "SCALAR":
      return 1;
    case "VEC2":
      return 2;
    case "VEC3":
      return 3;
    case "VEC4":
    case "MAT2":
      return 4;
    case "MAT3":
      return 9;
    case "MAT4":
      return 16;
    default:
      return null;
  }
}

function inspectSafeStructure(
  parsed: ParsedGlb,
  policy: GlbSafetyPolicy,
): GlbValidationReport {
  const buffers = recordArray(parsed.document.buffers, "buffers");
  const bufferData = buffers.map((buffer, index) => {
    const byteLength = integer(buffer.byteLength, 1);
    if (byteLength === null) {
      throw structureError("buffer byteLength 無效。");
    }
    if (buffer.uri === undefined) {
      if (
        index !== 0 ||
        !parsed.binary ||
        byteLength > parsed.binary.byteLength
      ) {
        throw structureError("GLB binary buffer 長度無效。");
      }
      return parsed.binary.subarray(0, byteLength);
    }
    if (typeof buffer.uri !== "string") {
      throw structureError("buffer URI 無效。");
    }
    const embedded = decodeDataUri(buffer.uri);
    if (embedded.bytes.byteLength < byteLength) {
      throw structureError("內嵌 buffer 長度不足。");
    }
    return embedded.bytes.subarray(0, byteLength);
  });

  const bufferViews = recordArray(parsed.document.bufferViews, "bufferViews");
  const bufferViewData = bufferViews.map((bufferView) => {
    const bufferIndex = integer(bufferView.buffer);
    const byteOffset = integer(bufferView.byteOffset ?? 0);
    const byteLength = integer(bufferView.byteLength, 1);
    if (
      bufferIndex === null ||
      byteOffset === null ||
      byteLength === null ||
      bufferData[bufferIndex] === undefined ||
      byteOffset + byteLength > bufferData[bufferIndex].byteLength
    ) {
      throw structureError("bufferView 超出 buffer 邊界。");
    }
    const byteStride = bufferView.byteStride;
    if (
      byteStride !== undefined &&
      (integer(byteStride, 4) === null || Number(byteStride) > 252)
    ) {
      throw structureError("bufferView byteStride 無效。");
    }
    return bufferData[bufferIndex].subarray(
      byteOffset,
      byteOffset + byteLength,
    );
  });
  const bufferViewLengths = bufferViewData.map((bytes) => bytes.byteLength);

  const accessors = recordArray(parsed.document.accessors, "accessors");
  let decodedGeometryBytes = 0;
  const accessorCounts = accessors.map((accessor) => {
    const count = integer(accessor.count, 1);
    const viewIndex = integer(accessor.bufferView);
    const bytesPerComponent = componentBytes(Number(accessor.componentType));
    const components = componentCount(accessor.type);
    const accessorOffset = integer(accessor.byteOffset ?? 0);
    if (
      count === null ||
      viewIndex === null ||
      bufferViewLengths[viewIndex] === undefined ||
      bytesPerComponent === null ||
      components === null ||
      accessorOffset === null
    ) {
      throw structureError("accessor 結構無效。");
    }
    const bufferView = bufferViews[viewIndex]!;
    const elementBytes = bytesPerComponent * components;
    const allocationBytes = count * elementBytes;
    if (!Number.isSafeInteger(allocationBytes)) {
      throw structureError("accessor 解碼大小無效。");
    }
    decodedGeometryBytes += allocationBytes;
    if (decodedGeometryBytes > policy.maxDecodedGeometryBytes) {
      throw structureError("GLB 解碼後的幾何資料超出安全限制。");
    }
    const stride = integer(bufferView.byteStride ?? elementBytes, elementBytes);
    if (
      stride === null ||
      accessorOffset + (count - 1) * stride + elementBytes >
        bufferViewLengths[viewIndex]!
    ) {
      throw structureError("accessor 超出 bufferView 邊界。");
    }
    return count;
  });

  const meshes = recordArray(parsed.document.meshes, "meshes");
  if (meshes.length === 0) {
    throw structureError("GLB 必須包含 mesh。");
  }
  let triangleCount = 0;
  let primitiveCount = 0;
  let largestDimensionMm = 0;
  for (const mesh of meshes) {
    const primitives = recordArray(mesh.primitives, "mesh primitives");
    if (primitives.length === 0) {
      throw structureError("mesh 必須包含 primitive。");
    }
    for (const primitive of primitives) {
      primitiveCount += 1;
      if (primitiveCount > policy.maxPrimitives) {
        throw structureError("GLB primitive 數量超出安全限制。");
      }
      if ((primitive.mode ?? 4) !== 4 || !isRecord(primitive.attributes)) {
        throw structureError("GLB 只接受三角形 mesh primitive。");
      }
      const positionIndex = integer(primitive.attributes.POSITION);
      const positionAccessor =
        positionIndex === null ? undefined : accessors[positionIndex];
      if (
        positionIndex === null ||
        !positionAccessor ||
        positionAccessor.type !== "VEC3" ||
        positionAccessor.componentType !== 5126
      ) {
        throw structureError("mesh POSITION accessor 無效。");
      }
      const min = positionAccessor.min;
      const max = positionAccessor.max;
      if (
        !Array.isArray(min) ||
        !Array.isArray(max) ||
        min.length !== 3 ||
        max.length !== 3
      ) {
        throw new GlbValidationError(
          "GLB_DIMENSIONS_EXCEEDED",
          "GLB 必須提供可驗證的 POSITION bounds。",
        );
      }
      const spans = min.map((value, index) => {
        const lower = finiteNumber(value);
        const upper = finiteNumber(max[index]);
        if (lower === null || upper === null || upper < lower) {
          throw structureError("POSITION bounds 無效。");
        }
        return upper - lower;
      });
      const diagonalMm = Math.hypot(...spans) * 1000;
      largestDimensionMm = Math.max(largestDimensionMm, diagonalMm);

      const hasIndices = primitive.indices !== undefined;
      const indexAccessorIndex = hasIndices ? integer(primitive.indices) : null;
      if (hasIndices && indexAccessorIndex === null) {
        throw structureError("三角形 index accessor 無效。");
      }
      if (indexAccessorIndex !== null) {
        const indexAccessor = accessors[indexAccessorIndex];
        if (
          !indexAccessor ||
          indexAccessor.type !== "SCALAR" ||
          ![5121, 5123, 5125].includes(Number(indexAccessor.componentType))
        ) {
          throw structureError("三角形 index accessor 無效。");
        }
      }
      const vertexOrIndexCount =
        indexAccessorIndex === null
          ? accessorCounts[positionIndex]
          : accessorCounts[indexAccessorIndex];
      if (vertexOrIndexCount === undefined || vertexOrIndexCount % 3 !== 0) {
        throw structureError("三角形 index 或 vertex count 無效。");
      }
      triangleCount += vertexOrIndexCount / 3;
      if (triangleCount > policy.maxTriangles) {
        throw new GlbValidationError(
          "GLB_POLYGON_LIMIT_EXCEEDED",
          "GLB 的三角形數量超出安全限制。",
        );
      }
    }
  }

  const nodes = recordArray(parsed.document.nodes, "nodes");
  if (nodes.length > policy.maxNodes) {
    throw structureError("GLB node 數量超出安全限制。");
  }
  const nodeScales: number[] = [];
  const nodeChildren: number[][] = [];
  const parentCounts = Array.from({ length: nodes.length }, () => 0);
  let nodeEdgeCount = 0;
  for (const node of nodes) {
    if (node.matrix !== undefined) {
      throw structureError("GLB 不接受未展開的 node matrix。");
    }
    let localScale = 1;
    if (node.scale !== undefined) {
      if (!Array.isArray(node.scale) || node.scale.length !== 3) {
        throw structureError("node scale 無效。");
      }
      for (const value of node.scale) {
        const scale = finiteNumber(value);
        if (scale === null || scale === 0) {
          throw structureError("node scale 無效。");
        }
        localScale = Math.max(localScale, Math.abs(scale));
      }
    }
    nodeScales.push(localScale);
    const children = node.children;
    if (children === undefined) {
      nodeChildren.push([]);
      continue;
    }
    if (!Array.isArray(children) || children.length > maxStructuralItems) {
      throw structureError("node children 結構無效。");
    }
    const childIndexes = children.map((child) => integer(child));
    if (
      childIndexes.some((child) => child === null || nodes[child] === undefined)
    ) {
      throw structureError("node child index 無效。");
    }
    const validChildren = childIndexes as number[];
    nodeEdgeCount += validChildren.length;
    if (nodeEdgeCount > policy.maxNodes) {
      throw structureError("GLB node 關係數量超出安全限制。");
    }
    for (const child of validChildren) {
      parentCounts[child] = (parentCounts[child] ?? 0) + 1;
      if (parentCounts[child] > 1) {
        throw structureError("node 不可有多個 parent。");
      }
    }
    nodeChildren.push(validChildren);
  }
  let maximumNodeScale = 1;
  const visited = new Set<number>();
  parentCounts.forEach((count, index) => {
    if (count === 0) {
      const pending = [{ index, inheritedScale: 1 }];
      while (pending.length > 0) {
        const current = pending.pop()!;
        if (visited.has(current.index)) {
          throw structureError("node graph 包含循環。");
        }
        visited.add(current.index);
        const cumulativeScale =
          current.inheritedScale * (nodeScales[current.index] ?? 1);
        if (!Number.isFinite(cumulativeScale)) {
          throw structureError("node scale 超出可驗證範圍。");
        }
        maximumNodeScale = Math.max(maximumNodeScale, cumulativeScale);
        for (const child of nodeChildren[current.index] ?? []) {
          pending.push({ index: child, inheritedScale: cumulativeScale });
        }
      }
    }
  });
  if (visited.size !== nodes.length) {
    throw structureError("node graph 包含循環。");
  }
  largestDimensionMm *= maximumNodeScale;
  if (largestDimensionMm > policy.maxDimensionMm) {
    throw new GlbValidationError(
      "GLB_DIMENSIONS_EXCEEDED",
      "GLB 的幾何尺寸超出安全限制。",
    );
  }

  const textures = recordArray(parsed.document.textures, "textures");
  const images = recordArray(parsed.document.images, "images");
  if (
    textures.length > policy.maxTextures ||
    images.length > policy.maxTextures
  ) {
    throw new GlbValidationError(
      "GLB_TEXTURE_LIMIT_EXCEEDED",
      "GLB 的貼圖數量超出安全限制。",
    );
  }
  for (const texture of textures) {
    const source = integer(texture.source);
    if (source === null || images[source] === undefined) {
      throw structureError("texture source 無效。");
    }
  }
  let textureBytes = 0;
  for (const image of images) {
    const mimeType = image.mimeType;
    if (
      mimeType !== undefined &&
      !["image/jpeg", "image/png", "image/webp"].includes(String(mimeType))
    ) {
      throw structureError("GLB 包含不支援的貼圖格式。");
    }
    if (typeof image.uri === "string") {
      const embedded = decodeDataUri(image.uri, [
        "image/jpeg",
        "image/png",
        "image/webp",
      ]);
      if (mimeType !== undefined && String(mimeType) !== embedded.mimeType) {
        throw structureError("GLB 內嵌貼圖 MIME 宣告不一致。");
      }
      validateEmbeddedImage(embedded.bytes, embedded.mimeType);
      textureBytes += embedded.bytes.byteLength;
    } else {
      const viewIndex = integer(image.bufferView);
      if (viewIndex === null || bufferViewLengths[viewIndex] === undefined) {
        throw structureError("內嵌貼圖 bufferView 無效。");
      }
      if (typeof mimeType !== "string") {
        throw structureError("內嵌貼圖缺少 MIME 宣告。");
      }
      validateEmbeddedImage(bufferViewData[viewIndex]!, mimeType);
      textureBytes += bufferViewLengths[viewIndex]!;
    }
    if (textureBytes > policy.maxTextureBytes) {
      throw new GlbValidationError(
        "GLB_TEXTURE_LIMIT_EXCEEDED",
        "GLB 的貼圖資料超出安全限制。",
      );
    }
  }

  return {
    dimensionMm: Math.ceil(largestDimensionMm),
    textureBytes,
    textureCount: textures.length,
    triangleCount,
  };
}

export function validateGlbSafety(
  bytes: Uint8Array,
  policy: GlbSafetyPolicy,
): GlbValidationReport {
  if (bytes.byteLength > policy.maxBytes) {
    throw new GlbValidationError(
      "GLB_LENGTH_MISMATCH",
      "GLB 超出檔案大小限制。",
    );
  }
  const parsed = parseGlb(bytes);
  if (policy.selfContained) {
    assertSelfContained(parsed.document);
  }
  return inspectSafeStructure(parsed, policy);
}

export function validateGeneratedGlb(
  bytes: Uint8Array,
  policy: GlbSafetyPolicy,
): GlbValidationReport {
  return validateGlbSafety(bytes, policy);
}
