import { describe, expect, it } from "vitest";

import { readBoundedCsv, readBoundedJson } from "./request-body";

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

  it("accepts bounded UTF-8 CSV bodies", async () => {
    const request = new Request("https://app.example/api/catalogue/import", {
      method: "POST",
      headers: { "content-type": "text/csv; charset=utf-8" },
      body: "sku,category\nCASE-001,case",
    });

    await expect(readBoundedCsv(request, 128)).resolves.toContain("CASE-001");
  });

  it.each(["text/csvx", "text/csv-malicious"])(
    "rejects the CSV prefix spoof %s before reading its body",
    async (contentType) => {
      const request = new Request("https://app.example/api/catalogue/import", {
        method: "POST",
        headers: { "content-type": contentType },
        body: "sku,category\nCASE-001,case",
      });

      await expect(readBoundedCsv(request)).rejects.toMatchObject({
        status: 415,
        code: "UNSUPPORTED_MEDIA_TYPE",
        message: expect.stringMatching(/CSV.*CSV/iu),
      });
      expect(request.bodyUsed).toBe(false);
    },
  );
});
