import { readFile } from "node:fs/promises";

import { parse } from "jsonc-parser";
import { describe, expect, it } from "vitest";

import {
  isProtectedWorkspacePath,
  privateWorkspaceAssetResponse,
  protectedWorkspaceRoutePatterns,
} from "./protected-routes";

describe("protected workspace routes", () => {
  it.each([
    "/dashboard",
    "/dashboard/activity",
    "/catalogue",
    "/catalogue/part/example",
    "/asset-review",
    "/asset-review/draft/example",
    "/builder",
    "/builder/build/example",
  ])("protects the parent and deep route %s", (pathname) => {
    expect(isProtectedWorkspacePath(pathname)).toBe(true);
  });

  it.each([
    "/",
    "/dashboard-public",
    "/catalogue-preview",
    "/asset-reviewer",
    "/builder-guide",
    "/api/health",
  ])("does not overmatch the public route %s", (pathname) => {
    expect(isProtectedWorkspacePath(pathname)).toBe(false);
  });

  it("keeps every protected parent and wildcard in Static Assets routing", async () => {
    const config = parse(
      await readFile(
        new URL("../../../wrangler.jsonc", import.meta.url),
        "utf8",
      ),
    ) as { assets?: { run_worker_first?: unknown } };

    expect(config.assets?.run_worker_first).toEqual([
      "/api",
      "/api/*",
      ...protectedWorkspaceRoutePatterns,
    ]);
  });

  it("marks an authenticated SPA shell private and non-cacheable", async () => {
    const response = privateWorkspaceAssetResponse(
      new Response("private shell", {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );

    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-type")).toBe("text/html");
    await expect(response.text()).resolves.toBe("private shell");
  });
});
