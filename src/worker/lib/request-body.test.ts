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
    });
    expect(cancelled).toBe(true);
    expect(pullCount).toBeLessThanOrEqual(chunks.length + 1);
  });

  it("accepts bounded UTF-8 CSV bodies", async () => {
    const request = new Request("https://app.example/api/catalogue/import", {
      method: "POST",
      headers: { "content-type": "text/csv; charset=utf-8" },
      body: "sku,category\nCASE-001,case",
    });

    await expect(readBoundedCsv(request, 128)).resolves.toContain("CASE-001");
  });
});
