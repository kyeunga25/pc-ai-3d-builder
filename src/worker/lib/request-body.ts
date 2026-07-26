import { ApiError } from "./api-error";

function bodyError(status: number, code: string, message: string): ApiError {
  return new ApiError(status, code, message);
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
    throw bodyError(413, "PAYLOAD_TOO_LARGE", "要求內容超出大小限制。");
  }

  if (!request.body) {
    throw bodyError(400, "VALIDATION_ERROR", "要求內容無效。");
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
        throw bodyError(413, "PAYLOAD_TOO_LARGE", "要求內容超出大小限制。");
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
    throw bodyError(400, "VALIDATION_ERROR", "要求內容無效。");
  }
}

export async function readBoundedJson(
  request: Request,
  maxBytes = 32 * 1024,
): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    throw bodyError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "要求內容必須使用 JSON 格式。",
    );
  }

  const text = decodeUtf8(await readBoundedBody(request, maxBytes));

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw bodyError(400, "VALIDATION_ERROR", "要求內容無效。");
  }
}

export async function readBoundedCsv(
  request: Request,
  maxBytes = 256 * 1024,
): Promise<string> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("text/csv")) {
    throw bodyError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "CSV 匯入必須使用 text/csv 格式。",
    );
  }

  return decodeUtf8(await readBoundedBody(request, maxBytes));
}
