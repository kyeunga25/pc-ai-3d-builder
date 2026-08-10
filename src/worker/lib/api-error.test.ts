import { describe, expect, it } from "vitest";

import { ApiError, apiErrorResponse, bilingualApiMessage } from "./api-error";

describe("public API error copy", () => {
  it("builds one normalized Traditional Chinese and English message", () => {
    expect(
      bilingualApiMessage("要求內容無效。", "The request content is invalid."),
    ).toBe("要求內容無效。 / The request content is invalid.");
  });

  it.each([
    ["Request content is invalid.", "missing Traditional Chinese"],
    ["要求內容無效。", "missing English"],
    ["要求內容無效。 / ", "empty English"],
  ])("rejects monolingual public copy: %s (%s)", (message) => {
    expect(() => new ApiError(400, "VALIDATION_ERROR", message)).toThrow(
      "Public API error messages must include Traditional Chinese and English",
    );
  });

  it("serializes only the bilingual public copy and stable error fields", async () => {
    const error = new ApiError(
      429,
      "RATE_LIMITED",
      bilingualApiMessage(
        "要求過於頻密，請稍後再試。",
        "Too many requests. Try again later.",
      ),
    );

    const response = apiErrorResponse(error, "request-public-safe");

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "RATE_LIMITED",
        message:
          "要求過於頻密，請稍後再試。 / Too many requests. Try again later.",
        requestId: "request-public-safe",
      },
    });
  });

  it.each([
    [404, "NOT_FOUND", "找不到要求。", "The request was not found."],
    [
      500,
      "INTERNAL_ERROR",
      "無法完成要求。",
      "The request could not be completed.",
    ],
  ])(
    "serializes the bilingual %i fallback through the shared boundary",
    async (status, code, zhHant, english) => {
      const response = apiErrorResponse(
        new ApiError(status, code, bilingualApiMessage(zhHant, english)),
        "request-fallback",
      );

      expect(response.status).toBe(status);
      expect(response.headers.get("cache-control")).toBe("no-store");
      await expect(response.json()).resolves.toEqual({
        error: {
          code,
          message: `${zhHant} / ${english}`,
          requestId: "request-fallback",
        },
      });
    },
  );
});
