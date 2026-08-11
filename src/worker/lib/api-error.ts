const bilingualSeparator = " / ";
const traditionalChinesePattern = /[\u3400-\u9fff]/u;
const englishPattern = /[A-Za-z]/u;

export function bilingualApiMessage(zhHant: string, english: string): string {
  const normalizedZhHant = zhHant.trim();
  const normalizedEnglish = english.trim();
  if (
    !traditionalChinesePattern.test(normalizedZhHant) ||
    !englishPattern.test(normalizedEnglish)
  ) {
    throw new TypeError(
      "Public API error messages must include Traditional Chinese and English",
    );
  }
  return `${normalizedZhHant}${bilingualSeparator}${normalizedEnglish}`;
}

function isBilingualApiMessage(message: string): boolean {
  const separatorIndex = message.indexOf(bilingualSeparator);
  if (separatorIndex < 0) return false;
  const zhHant = message.slice(0, separatorIndex).trim();
  const english = message
    .slice(separatorIndex + bilingualSeparator.length)
    .trim();
  return traditionalChinesePattern.test(zhHant) && englishPattern.test(english);
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    if (!isBilingualApiMessage(message)) {
      throw new TypeError(
        "Public API error messages must include Traditional Chinese and English",
      );
    }
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function apiErrorResponse(error: ApiError, requestId: string): Response {
  const headers = new Headers({ "cache-control": "no-store" });
  if (error.status === 429) {
    headers.set("retry-after", "60");
  }

  return Response.json(
    {
      error: {
        code: error.code,
        message: error.message,
        requestId,
      },
    },
    {
      status: error.status,
      headers,
    },
  );
}
