import { describe, expect, it } from "vitest";

import {
  apiRoutePolicy,
  isApiMethodAllowed,
  methodNotAllowedResponse,
} from "./api-routing";

const routePolicies = [
  ["/api/health", "public", ["GET"], "GET"],
  ["/api/session", "protected", ["GET"], "GET"],
  ["/api/session/workspace", "protected", ["PUT"], "PUT"],
  ["/api/workspaces", "protected", ["GET"], "GET"],
  ["/api/dashboard", "protected", ["GET"], "GET"],
  ["/api/workspace/activity", "protected", ["GET"], "GET"],
  ["/api/workspace/members", "protected", ["GET", "POST"], "GET, POST"],
  ["/api/workspace/member", "protected", ["PATCH"], "PATCH"],
  ["/api/catalogue", "protected", ["GET", "POST"], "GET, POST"],
  ["/api/catalogue/import", "protected", ["POST"], "POST"],
  ["/api/builds", "protected", ["GET", "POST"], "GET, POST"],
  ["/api/build/export", "protected", ["GET"], "GET"],
  ["/api/build", "protected", ["GET", "PATCH"], "GET, PATCH"],
  ["/api/catalogue/part", "protected", ["PATCH"], "PATCH"],
  ["/api/catalogue/part/source", "protected", ["POST"], "POST"],
  ["/api/assets/review-queue", "protected", ["GET"], "GET"],
  ["/api/assets/item/review", "protected", ["PATCH"], "PATCH"],
  ["/api/assets/item", "protected", ["GET"], "GET"],
  ["/api/assets/item/file", "protected", ["GET", "PUT"], "GET, PUT"],
  [
    "/api/assets/item/generation-jobs",
    "protected",
    ["GET", "POST"],
    "GET, POST",
  ],
] as const;

describe("API route policy", () => {
  it.each(routePolicies)(
    "defines the exact access and method policy for %s",
    (pathname, access, methods, allow) => {
      const policy = apiRoutePolicy(pathname);

      expect(policy).toEqual({ access, methods, allow });
      for (const method of methods) {
        expect(isApiMethodAllowed(policy, method)).toBe(true);
      }
      expect(isApiMethodAllowed(policy, "DELETE")).toBe(false);
      expect(isApiMethodAllowed(policy, methods[0].toLowerCase())).toBe(false);
    },
  );

  it.each([
    "/api",
    "/api/unknown",
    "/api/health/",
    "/API/health",
    "/api/assets/item/private-id",
  ])("does not approximate or expose an unknown path: %s", (pathname) => {
    expect(apiRoutePolicy(pathname)).toBeNull();
  });

  it("returns a stable bilingual 405 response with the exact Allow header", async () => {
    const policy = apiRoutePolicy("/api/build");
    if (!policy) throw new Error("Expected the build route policy");

    const response = methodNotAllowedResponse(policy, "request-routing-test");

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, PATCH");
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "METHOD_NOT_ALLOWED",
        message:
          "此 API 路徑不接受所使用的要求方法。 / This API path does not allow the requested method.",
        requestId: "request-routing-test",
      },
    });
  });
});
