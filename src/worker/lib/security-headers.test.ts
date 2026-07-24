import { describe, expect, it } from "vitest";

import { withPublicSecurityHeaders } from "./security-headers";

describe("withPublicSecurityHeaders", () => {
  it("preserves the response and adds restrictive browser headers", async () => {
    const response = withPublicSecurityHeaders(
      new Response("ok", {
        status: 202,
        headers: { "cache-control": "no-store" },
      }),
    );

    expect(response.status).toBe(202);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(response.headers.get("content-security-policy")).toContain(
      "frame-ancestors 'none'",
    );
    await expect(response.text()).resolves.toBe("ok");
  });
});
