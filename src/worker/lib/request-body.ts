import { ApiError } from "./api-error";

function bodyError(status: number, code: string, message: string): ApiError {
  return new ApiError(status, code, message);
}

function requestMediaType(request: Request): string {
  return (
    request.headers
      .get("content-type")
      ?.split(";", 1)[0]
      ?.trim()
      .toLowerCase() ?? ""
  );
}

export function assertBodylessRequest(request: Request): void {
  if (request.body === null) {
    return;
  }
  throw bodyError(
    400,
    "UNEXPECTED_REQUEST_BODY",
    "此操作不接受要求內容。 / This operation does not accept a request body.",
  );
}

async function readBoundedBody(
  request: Request,
  maxBytes: number,
): Promise<Uint8Array> {
  const contentLength = request.headers.get("content-length");
  if (
    contentLength &&
    /^\d+$/u.test(contentLength) &&
    Number(contentLength) > maxBytes
  ) {
    throw bodyError(
      413,
      "PAYLOAD_TOO_LARGE",
      "要求內容超出大小限制。 / The request content exceeds the size limit.",
    );
  }

  if (!request.body) {
    throw bodyError(
      400,
      "VALIDATION_ERROR",
      "要求內容無效。 / The request content is invalid.",
    );
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          // The bounded-read rejection below remains the public failure mode.
        }
        throw bodyError(
          413,
          "PAYLOAD_TOO_LARGE",
          "要求內容超出大小限制。 / The request content exceeds the size limit.",
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return body;
}

function decodeUtf8(body: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", {
      fatal: true,
      ignoreBOM: false,
    }).decode(body);
  } catch {
    throw bodyError(
      400,
      "VALIDATION_ERROR",
      "要求內容無效。 / The request content is invalid.",
    );
  }
}

export async function readBoundedJson(
  request: Request,
  maxBytes = 32 * 1024,
): Promise<unknown> {
  if (requestMediaType(request) !== "application/json") {
    throw bodyError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "要求內容必須使用 JSON 格式。 / Request content must use application/json.",
    );
  }

  const text = decodeUtf8(await readBoundedBody(request, maxBytes));

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw bodyError(
      400,
      "VALIDATION_ERROR",
      "要求內容無效。 / The request content is invalid.",
    );
  }
}

export async function readBoundedCsv(
  request: Request,
  maxBytes = 256 * 1024,
): Promise<string> {
  if (requestMediaType(request) !== "text/csv") {
    throw bodyError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "CSV 匯入必須使用 text/csv 格式。 / CSV imports must use text/csv.",
    );
  }

  return decodeUtf8(await readBoundedBody(request, maxBytes));
}

export async function readBoundedBinary(
  request: Request,
  maxBytes: number,
): Promise<Uint8Array> {
  return readBoundedBody(request, maxBytes);
}
