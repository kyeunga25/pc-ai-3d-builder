import { describe, expect, it } from "vitest";

import {
  assertBodylessRequest,
  readBoundedCatalogueImport,
  readBoundedJson,
} from "./request-body";

describe("bodyless requests", () => {
  it("accepts an absent body without consuming the request", () => {
    const request = new Request("https://app.example/api/cancel", {
      method: "DELETE",
    });

    expect(() => assertBodylessRequest(request)).not.toThrow();
    expect(request.bodyUsed).toBe(false);
  });

  it("rejects any supplied body without consuming or reflecting it", () => {
    const request = new Request("https://app.example/api/cancel", {
      method: "DELETE",
      body: "private-input",
    });

    expect(() => assertBodylessRequest(request)).toThrowError(
      expect.objectContaining({
        status: 400,
        code: "UNEXPECTED_REQUEST_BODY",
        message: expect.stringMatching(
          /不接受要求內容.+does not accept a request body/iu,
        ),
      }),
    );
    expect(request.bodyUsed).toBe(false);
  });
});

describe("bounded JSON request bodies", () => {
  it("parses a JSON body within the configured limit", async () => {
    const request = new Request("https://app.example/api/review", {
      method: "PATCH",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ action: "save_draft" }),
    });

    await expect(readBoundedJson(request, 128)).resolves.toEqual({
      action: "save_draft",
    });
  });

  it("rejects unsupported content types", async () => {
    const request = new Request("https://app.example/api/review", {
      method: "PATCH",
      headers: { "content-type": "text/plain" },
      body: "not-json",
    });

    await expect(readBoundedJson(request)).rejects.toMatchObject({
      status: 415,
      code: "UNSUPPORTED_MEDIA_TYPE",
    });
  });

  it.each(["application/jsonp", "application/json-evil"])(
    "rejects the JSON prefix spoof %s before reading its body",
    async (contentType) => {
      const request = new Request("https://app.example/api/review", {
        method: "PATCH",
        headers: { "content-type": contentType },
        body: JSON.stringify({ action: "save_draft" }),
      });

      await expect(readBoundedJson(request)).rejects.toMatchObject({
        status: 415,
        code: "UNSUPPORTED_MEDIA_TYPE",
        message: expect.stringMatching(/JSON.*JSON/iu),
      });
      expect(request.bodyUsed).toBe(false);
    },
  );

  it("accepts a case-insensitive JSON media type with parameters", async () => {
    const request = new Request("https://app.example/api/review", {
      method: "PATCH",
      headers: { "content-type": "Application/JSON ; Charset=UTF-8" },
      body: JSON.stringify({ action: "save_draft" }),
    });

    await expect(readBoundedJson(request)).resolves.toEqual({
      action: "save_draft",
    });
  });

  it("stops reading when a streamed body exceeds the limit", async () => {
    const encoder = new TextEncoder();
    const chunks = [encoder.encode('{"a":'), encoder.encode('"value"}')];
    let pullCount = 0;
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        const chunk = chunks[pullCount];
        pullCount += 1;
        if (chunk) {
          controller.enqueue(chunk);
        } else {
          controller.close();
        }
      },
      cancel() {
        cancelled = true;
      },
    });
    const request = new Request("https://app.example/api/review", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    await expect(readBoundedJson(request, 8)).rejects.toMatchObject({
      status: 413,
      code: "PAYLOAD_TOO_LARGE",
      message: expect.stringMatching(/大小限制.+size limit/iu),
    });
    expect(cancelled).toBe(true);
    expect(pullCount).toBeLessThanOrEqual(chunks.length + 1);
  });

  it("returns bilingual copy for malformed UTF-8 or JSON", async () => {
    const request = new Request("https://app.example/api/review", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: "{malformed",
    });

    await expect(readBoundedJson(request)).rejects.toMatchObject({
      status: 400,
      code: "VALIDATION_ERROR",
      message: expect.stringMatching(/內容無效.+content is invalid/iu),
    });
  });

  it.each([
    ["csv", "text/csv; charset=utf-8", "sku,category\nCASE-001,case"],
    [
      "tsv",
      "text/tab-separated-values; charset=utf-8",
      "sku\tcategory\nCASE-001\tcase",
    ],
  ] as const)(
    "accepts a bounded UTF-8 %s body",
    async (format, contentType, body) => {
      const request = new Request("https://app.example/api/catalogue/import", {
        method: "POST",
        headers: { "content-type": contentType },
        body,
      });

      await expect(readBoundedCatalogueImport(request, 128)).resolves.toEqual({
        format,
        text: expect.stringContaining("CASE-001"),
      });
    },
  );

  it.each(["text/csvx", "text/csv-malicious", "text/tab-separated-valuesx"])(
    "rejects the catalogue media-type prefix spoof %s before reading its body",
    async (contentType) => {
      const request = new Request("https://app.example/api/catalogue/import", {
        method: "POST",
        headers: { "content-type": contentType },
        body: "sku,category\nCASE-001,case",
      });

      await expect(readBoundedCatalogueImport(request)).rejects.toMatchObject({
        status: 415,
        code: "UNSUPPORTED_MEDIA_TYPE",
        message: expect.stringMatching(/CSV.+TSV.+CSV.+TSV/iu),
      });
      expect(request.bodyUsed).toBe(false);
    },
  );
});
