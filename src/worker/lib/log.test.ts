import { afterEach, describe, expect, it, vi } from "vitest";

import { logRequestRecord, requestRouteTemplate } from "./log";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("request log route templates", () => {
  it.each([
    ["/api/builds/build_private_123/export", "/api/builds/:buildId/export"],
    ["/api/builds/build_private_123", "/api/builds/:buildId"],
    [
      "/api/catalogue/part_private_123/assets/source",
      "/api/catalogue/:partId/assets/source",
    ],
    ["/api/catalogue/part_private_123", "/api/catalogue/:partId"],
    [
      "/api/assets/asset_private_123/files/source-private-key",
      "/api/assets/:assetId/files/:fileKind",
    ],
    [
      "/api/assets/asset_private_123/generation-jobs",
      "/api/assets/:assetId/generation-jobs",
    ],
    ["/api/assets/asset_private_123/review", "/api/assets/:assetId/review"],
    ["/api/assets/asset_private_123", "/api/assets/:assetId"],
    ["/builder/build/build_private_123", "/builder/*"],
    ["/asset-review/draft/asset_private_123", "/asset-review/*"],
    ["/DASHBOARD", "/dashboard"],
    ["/Asset-Review/draft/asset_private_123", "/asset-review/*"],
    ["/demo/catalogue/part_private_123", "/demo/*"],
  ])("maps %s to %s", (pathname, expected) => {
    const template = requestRouteTemplate(pathname);

    expect(template).toBe(expected);
    expect(template).not.toContain("private_123");
  });

  it("logs only a stable route without URL query or dynamic identifiers", () => {
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
    const request = new Request(
      "https://rigstage.invalid/api/assets/asset_private_123/generation-jobs?email=owner%40example.test&workspace=workspace_private_456",
      { method: "POST" },
    );

    logRequestRecord("info", request, {
      durationMs: 8,
      event: "request.complete",
      method: request.method,
      requestId: "request-public-safe",
      status: 202,
    });

    expect(consoleLog).toHaveBeenCalledTimes(1);
    const serialized = String(consoleLog.mock.calls[0]?.[0]);
    expect(JSON.parse(serialized)).toEqual({
      durationMs: 8,
      event: "request.complete",
      method: "POST",
      requestId: "request-public-safe",
      status: 202,
      path: "/api/assets/:assetId/generation-jobs",
    });
    expect(serialized).not.toContain("asset_private_123");
    expect(serialized).not.toContain("owner@example.test");
    expect(serialized).not.toContain("workspace_private_456");
  });

  it("uses generic categories for unknown paths", () => {
    expect(requestRouteTemplate("/api/private/object-key-123")).toBe("/api/*");
    expect(requestRouteTemplate("/private/object-key-123")).toBe("/public/*");
  });

  it("applies the same redaction to error logs", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const request = new Request(
      "https://rigstage.invalid/api/builds/build_private_123?email=owner%40example.test",
    );

    logRequestRecord("error", request, {
      durationMs: 3,
      error: "UNEXPECTED_ERROR",
      event: "request.failed",
      method: "GET",
      requestId: "request-public-safe",
      status: 500,
    });

    const serialized = String(consoleError.mock.calls[0]?.[0]);
    expect(JSON.parse(serialized)).toMatchObject({
      path: "/api/builds/:buildId",
    });
    expect(serialized).not.toContain("build_private_123");
    expect(serialized).not.toContain("owner@example.test");
  });
});
