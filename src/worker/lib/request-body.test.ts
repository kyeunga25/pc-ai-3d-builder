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
    const request = new Request("https://app.example/api/review", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value: "larger than limit" }),
    });

    await expect(readBoundedJson(request, 8)).rejects.toMatchObject({
      status: 413,
      code: "PAYLOAD_TOO_LARGE",
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
});
