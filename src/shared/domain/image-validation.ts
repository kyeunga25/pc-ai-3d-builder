export type SupportedImageContentType =
  "image/jpeg" | "image/png" | "image/webp";

export class ImageStructureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageStructureError";
  }
}

const maximumDimension = 32_768;
const maximumPixels = 100_000_000;
const maximumAnimationFrames = 120;

function invalid(message: string): never {
  throw new ImageStructureError(message);
}

function dataView(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function bytesEqual(
  bytes: Uint8Array,
  offset: number,
  expected: readonly number[],
): boolean {
  return expected.every((value, index) => bytes[offset + index] === value);
}

function assertDimensions(width: number, height: number): void {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    width > maximumDimension ||
    height > maximumDimension ||
    width * height > maximumPixels
  ) {
    invalid("Image dimensions are invalid or exceed the safety limit.");
  }
}

const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  let current = value;
  for (let bit = 0; bit < 8; bit += 1) {
    current =
      (current & 1) === 1 ? 0xedb88320 ^ (current >>> 1) : current >>> 1;
  }
  return current >>> 0;
});

function crc32(bytes: Uint8Array, start: number, end: number): number {
  let crc = 0xffffffff;
  for (let index = start; index < end; index += 1) {
    crc = crcTable[(crc ^ bytes[index]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunkType(bytes: Uint8Array, offset: number): string {
  let type = "";
  for (let index = 0; index < 4; index += 1) {
    const value = bytes[offset + index]!;
    if (!(
      (value >= 0x41 && value <= 0x5a) ||
      (value >= 0x61 && value <= 0x7a)
    )) {
      invalid("PNG chunk type is invalid.");
    }
    type += String.fromCharCode(value);
  }
  return type;
}

function validatePng(bytes: Uint8Array): void {
  if (
    bytes.byteLength < 45 ||
    !bytesEqual(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  ) {
    invalid("PNG signature or minimum container length is invalid.");
  }
  const view = dataView(bytes);
  let cursor = 8;
  let colorType: number | null = null;
  let sawHeader = false;
  let sawImageData = false;
  let sawPalette = false;
  let imageDataBytes = 0;
  let imageDataEnded = false;
  while (cursor < bytes.byteLength) {
    if (bytes.byteLength - cursor < 12) {
      invalid("PNG chunk is truncated.");
    }
    const length = view.getUint32(cursor, false);
    if (length > bytes.byteLength - cursor - 12) {
      invalid("PNG chunk length exceeds the container.");
    }
    const type = chunkType(bytes, cursor + 4);
    const dataStart = cursor + 8;
    const dataEnd = dataStart + length;
    const chunkEnd = dataEnd + 4;
    if (view.getUint32(dataEnd, false) !== crc32(bytes, cursor + 4, dataEnd)) {
      invalid("PNG chunk checksum is invalid.");
    }
    if (
      bytes[cursor + 4]! >= 0x41 &&
      bytes[cursor + 4]! <= 0x5a &&
      !["IHDR", "PLTE", "IDAT", "IEND"].includes(type)
    ) {
      invalid("PNG contains an unsupported critical chunk.");
    }
    if (sawImageData && type !== "IDAT") {
      imageDataEnded = true;
    }

    if (!sawHeader && type !== "IHDR") {
      invalid("PNG must begin with IHDR.");
    }
    if (type === "IHDR") {
      if (sawHeader || length !== 13) {
        invalid("PNG IHDR is invalid or duplicated.");
      }
      sawHeader = true;
      const width = view.getUint32(dataStart, false);
      const height = view.getUint32(dataStart + 4, false);
      assertDimensions(width, height);
      const bitDepth = bytes[dataStart + 8]!;
      colorType = bytes[dataStart + 9]!;
      const validDepths: Record<number, readonly number[]> = {
        0: [1, 2, 4, 8, 16],
        2: [8, 16],
        3: [1, 2, 4, 8],
        4: [8, 16],
        6: [8, 16],
      };
      if (
        !validDepths[colorType]?.includes(bitDepth) ||
        bytes[dataStart + 10] !== 0 ||
        bytes[dataStart + 11] !== 0 ||
        ![0, 1].includes(bytes[dataStart + 12]!)
      ) {
        invalid("PNG IHDR encoding fields are invalid.");
      }
    } else if (type === "PLTE") {
      if (
        sawPalette ||
        sawImageData ||
        colorType === 0 ||
        colorType === 4 ||
        length < 3 ||
        length > 768 ||
        length % 3 !== 0
      ) {
        invalid("PNG palette is invalid or out of order.");
      }
      sawPalette = true;
    } else if (type === "IDAT") {
      if (!sawHeader || imageDataEnded || (colorType === 3 && !sawPalette)) {
        invalid("PNG IDAT is invalid or out of order.");
      }
      sawImageData = true;
      imageDataBytes += length;
    } else if (type === "IEND") {
      if (
        length !== 0 ||
        !sawImageData ||
        imageDataBytes === 0 ||
        chunkEnd !== bytes.byteLength
      ) {
        invalid("PNG IEND is invalid or not terminal.");
      }
      return;
    }
    cursor = chunkEnd;
  }
  invalid("PNG is missing a terminal IEND chunk.");
}

function isStartOfFrame(marker: number): boolean {
  return [
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce,
    0xcf,
  ].includes(marker);
}

function isRestartMarker(marker: number): boolean {
  return marker >= 0xd0 && marker <= 0xd7;
}

function validateJpeg(bytes: Uint8Array): void {
  if (bytes.byteLength < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    invalid("JPEG SOI marker is invalid.");
  }
  let cursor = 2;
  let sawFrame = false;
  let sawScan = false;
  while (cursor < bytes.byteLength) {
    if (bytes[cursor] !== 0xff) {
      invalid("JPEG marker prefix is missing.");
    }
    const markerStart = cursor;
    while (bytes[cursor] === 0xff) {
      cursor += 1;
    }
    if (cursor >= bytes.byteLength) {
      invalid("JPEG marker is truncated.");
    }
    const marker = bytes[cursor++]!;
    if (marker === 0x00 || marker === 0xd8) {
      invalid("JPEG marker sequence is invalid.");
    }
    if (marker === 0xd9) {
      if (!sawFrame || !sawScan || cursor !== bytes.byteLength) {
        invalid("JPEG EOI is invalid or not terminal.");
      }
      return;
    }
    if (marker === 0x01 || isRestartMarker(marker)) {
      continue;
    }
    if (bytes.byteLength - cursor < 2) {
      invalid("JPEG segment length is truncated.");
    }
    const length = (bytes[cursor]! << 8) | bytes[cursor + 1]!;
    if (length < 2 || length > bytes.byteLength - cursor) {
      invalid("JPEG segment exceeds the container.");
    }
    const dataStart = cursor + 2;
    const dataEnd = cursor + length;
    if (isStartOfFrame(marker)) {
      if (sawFrame || length < 11) {
        invalid("JPEG frame header is invalid or duplicated.");
      }
      const components = bytes[dataStart + 5]!;
      if (components < 1 || components > 4 || length !== 8 + components * 3) {
        invalid("JPEG frame components are invalid.");
      }
      assertDimensions(
        (bytes[dataStart + 3]! << 8) | bytes[dataStart + 4]!,
        (bytes[dataStart + 1]! << 8) | bytes[dataStart + 2]!,
      );
      sawFrame = true;
    }
    if (marker === 0xda) {
      if (!sawFrame || length < 8) {
        invalid("JPEG scan header is invalid.");
      }
      const components = bytes[dataStart]!;
      if (components < 1 || components > 4 || length !== 6 + components * 2) {
        invalid("JPEG scan components are invalid.");
      }
      sawScan = true;
      cursor = dataEnd;
      let foundMarker = false;
      while (cursor < bytes.byteLength) {
        if (bytes[cursor] !== 0xff) {
          cursor += 1;
          continue;
        }
        const entropyMarkerStart = cursor;
        while (bytes[cursor] === 0xff) {
          cursor += 1;
        }
        if (cursor >= bytes.byteLength) {
          invalid("JPEG entropy marker is truncated.");
        }
        const entropyMarker = bytes[cursor]!;
        if (entropyMarker === 0x00 || isRestartMarker(entropyMarker)) {
          cursor += 1;
          continue;
        }
        cursor = entropyMarkerStart;
        foundMarker = true;
        break;
      }
      if (!foundMarker) {
        invalid("JPEG scan is missing a following marker.");
      }
      continue;
    }
    cursor = dataEnd;
    if (cursor <= markerStart) {
      invalid("JPEG parser made no progress.");
    }
  }
  invalid("JPEG is missing a terminal EOI marker.");
}

function readFourCc(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(
    bytes[offset]!,
    bytes[offset + 1]!,
    bytes[offset + 2]!,
    bytes[offset + 3]!,
  );
}

function uint24Le(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16)
  );
}

type ImageDimensions = {
  height: number;
  width: number;
};

type WebpChunk = {
  dataEnd: number;
  dataStart: number;
  length: number;
  paddedEnd: number;
  type: string;
};

function webpChunkAt(
  bytes: Uint8Array,
  view: DataView,
  cursor: number,
  limit: number,
): WebpChunk {
  if (limit - cursor < 8) {
    invalid("WebP chunk header is truncated.");
  }
  const length = view.getUint32(cursor + 4, true);
  if (length > limit - cursor - 8) {
    invalid("WebP chunk exceeds the container.");
  }
  const dataStart = cursor + 8;
  const dataEnd = dataStart + length;
  const paddedEnd = dataEnd + (length & 1);
  if (paddedEnd > limit) {
    invalid("WebP chunk padding exceeds the container.");
  }
  if ((length & 1) === 1 && bytes[dataEnd] !== 0) {
    invalid("WebP chunk padding must be zero.");
  }
  return {
    dataEnd,
    dataStart,
    length,
    paddedEnd,
    type: readFourCc(bytes, cursor),
  };
}

function validateWebpBitstream(
  bytes: Uint8Array,
  view: DataView,
  chunk: WebpChunk,
): ImageDimensions {
  let width: number;
  let height: number;
  if (chunk.type === "VP8 ") {
    if (
      chunk.length < 10 ||
      (bytes[chunk.dataStart]! & 1) !== 0 ||
      !bytesEqual(bytes, chunk.dataStart + 3, [0x9d, 0x01, 0x2a])
    ) {
      invalid("WebP VP8 frame header is invalid.");
    }
    width = view.getUint16(chunk.dataStart + 6, true) & 0x3fff;
    height = view.getUint16(chunk.dataStart + 8, true) & 0x3fff;
  } else if (chunk.type === "VP8L") {
    if (
      chunk.length < 5 ||
      bytes[chunk.dataStart] !== 0x2f ||
      bytes[chunk.dataStart + 4]! >> 5 !== 0
    ) {
      invalid("WebP VP8L frame header is invalid.");
    }
    width =
      1 +
      bytes[chunk.dataStart + 1]! +
      ((bytes[chunk.dataStart + 2]! & 0x3f) << 8);
    height =
      1 +
      (bytes[chunk.dataStart + 2]! >> 6) +
      (bytes[chunk.dataStart + 3]! << 2) +
      ((bytes[chunk.dataStart + 4]! & 0x0f) << 10);
  } else {
    invalid("WebP image payload type is invalid.");
  }
  assertDimensions(width, height);
  return { height, width };
}

function validateWebpAlpha(bytes: Uint8Array, chunk: WebpChunk): void {
  if (chunk.length < 1 || (bytes[chunk.dataStart]! & 0xc0) !== 0) {
    invalid("WebP alpha chunk is invalid.");
  }
}

function validateWebpAnimationFrame(
  bytes: Uint8Array,
  view: DataView,
  chunk: WebpChunk,
  canvas: ImageDimensions,
): number {
  if (chunk.length < 16) {
    invalid("WebP animation frame header is invalid.");
  }
  const frameX = uint24Le(bytes, chunk.dataStart) * 2;
  const frameY = uint24Le(bytes, chunk.dataStart + 3) * 2;
  const frame = {
    width: uint24Le(bytes, chunk.dataStart + 6) + 1,
    height: uint24Le(bytes, chunk.dataStart + 9) + 1,
  };
  assertDimensions(frame.width, frame.height);
  if (
    frameX + frame.width > canvas.width ||
    frameY + frame.height > canvas.height ||
    (bytes[chunk.dataStart + 15]! & 0xfc) !== 0
  ) {
    invalid("WebP animation frame exceeds its canvas or uses reserved bits.");
  }

  let cursor = chunk.dataStart + 16;
  let sawAlpha = false;
  let bitstream: ImageDimensions | null = null;
  while (cursor < chunk.dataEnd) {
    const child = webpChunkAt(bytes, view, cursor, chunk.dataEnd);
    if (child.type === "ALPH") {
      if (sawAlpha || bitstream) {
        invalid("WebP animation alpha chunk is duplicated or out of order.");
      }
      validateWebpAlpha(bytes, child);
      sawAlpha = true;
    } else if (child.type === "VP8 " || child.type === "VP8L") {
      if (bitstream || (child.type === "VP8L" && sawAlpha)) {
        invalid("WebP animation bitstream is duplicated or inconsistent.");
      }
      bitstream = validateWebpBitstream(bytes, view, child);
    } else if (!bitstream) {
      invalid("WebP animation frame data is out of order.");
    }
    cursor = child.paddedEnd;
  }
  if (
    cursor !== chunk.dataEnd ||
    !bitstream ||
    bitstream.width !== frame.width ||
    bitstream.height !== frame.height
  ) {
    invalid("WebP animation frame is missing a matching image bitstream.");
  }
  return frame.width * frame.height;
}

function validateWebp(bytes: Uint8Array): void {
  if (
    bytes.byteLength < 20 ||
    !bytesEqual(bytes, 0, [0x52, 0x49, 0x46, 0x46]) ||
    !bytesEqual(bytes, 8, [0x57, 0x45, 0x42, 0x50])
  ) {
    invalid("WebP RIFF signature or minimum length is invalid.");
  }
  const view = dataView(bytes);
  if (view.getUint32(4, true) !== bytes.byteLength - 8) {
    invalid("WebP RIFF length does not match the container.");
  }
  const first = webpChunkAt(bytes, view, 12, bytes.byteLength);
  if (first.type === "VP8 " || first.type === "VP8L") {
    if (first.paddedEnd !== bytes.byteLength) {
      invalid("Simple WebP must contain exactly one image bitstream.");
    }
    validateWebpBitstream(bytes, view, first);
    return;
  }
  if (first.type !== "VP8X" || first.length !== 10) {
    invalid("Extended WebP must begin with a VP8X chunk.");
  }
  const flags = bytes[first.dataStart]!;
  if (
    (flags & 0xc1) !== 0 ||
    bytes[first.dataStart + 1] !== 0 ||
    bytes[first.dataStart + 2] !== 0 ||
    bytes[first.dataStart + 3] !== 0
  ) {
    invalid("WebP VP8X reserved bits are invalid.");
  }
  const canvas = {
    width: uint24Le(bytes, first.dataStart + 4) + 1,
    height: uint24Le(bytes, first.dataStart + 7) + 1,
  };
  assertDimensions(canvas.width, canvas.height);
  const animated = (flags & 0x02) !== 0;
  let cursor = first.paddedEnd;
  let sawAlpha = false;
  let sawAnimationControl = false;
  let sawAnimationFrame = false;
  let animationFrames = 0;
  let animationPixels = 0;
  let stillBitstream: ImageDimensions | null = null;
  while (cursor < bytes.byteLength) {
    const chunk = webpChunkAt(bytes, view, cursor, bytes.byteLength);
    if (chunk.type === "VP8X") {
      invalid("WebP VP8X chunk is duplicated or out of order.");
    } else if (chunk.type === "ANIM") {
      if (
        !animated ||
        sawAnimationControl ||
        sawAnimationFrame ||
        chunk.length !== 6
      ) {
        invalid("WebP animation control is invalid or out of order.");
      }
      sawAnimationControl = true;
    } else if (chunk.type === "ANMF") {
      if (!animated || !sawAnimationControl) {
        invalid("WebP animation frame is out of order.");
      }
      animationFrames += 1;
      animationPixels += validateWebpAnimationFrame(bytes, view, chunk, canvas);
      if (
        animationFrames > maximumAnimationFrames ||
        animationPixels > maximumPixels
      ) {
        invalid("WebP animation exceeds the frame or aggregate pixel limit.");
      }
      sawAnimationFrame = true;
    } else if (chunk.type === "ALPH") {
      if (animated || sawAlpha || stillBitstream) {
        invalid("WebP alpha chunk is duplicated or out of order.");
      }
      validateWebpAlpha(bytes, chunk);
      sawAlpha = true;
    } else if (chunk.type === "VP8 " || chunk.type === "VP8L") {
      if (animated || stillBitstream || (chunk.type === "VP8L" && sawAlpha)) {
        invalid("WebP still-image bitstream is duplicated or inconsistent.");
      }
      stillBitstream = validateWebpBitstream(bytes, view, chunk);
    }
    cursor = chunk.paddedEnd;
  }
  if (cursor !== bytes.byteLength) {
    invalid("WebP chunk sequence is truncated.");
  }
  if (animated) {
    if (!sawAnimationControl || !sawAnimationFrame || stillBitstream) {
      invalid("WebP animation is missing control data or frames.");
    }
  } else if (
    !stillBitstream ||
    stillBitstream.width !== canvas.width ||
    stillBitstream.height !== canvas.height
  ) {
    invalid("WebP still image is missing a canvas-matched bitstream.");
  }
}

export function validateImageStructure(
  bytes: Uint8Array,
): SupportedImageContentType {
  if (
    bytes.byteLength >= 8 &&
    bytesEqual(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  ) {
    validatePng(bytes);
    return "image/png";
  }
  if (bytes.byteLength >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    validateJpeg(bytes);
    return "image/jpeg";
  }
  if (
    bytes.byteLength >= 12 &&
    bytesEqual(bytes, 0, [0x52, 0x49, 0x46, 0x46]) &&
    bytesEqual(bytes, 8, [0x57, 0x45, 0x42, 0x50])
  ) {
    validateWebp(bytes);
    return "image/webp";
  }
  invalid("Image signature is not supported.");
}
