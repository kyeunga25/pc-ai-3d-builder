import { readFile } from "node:fs/promises";

import { parse } from "jsonc-parser";
import { describe, expect, it } from "vitest";

import {
  isProtectedWorkspacePath,
  privateWorkspaceAssetResponse,
  protectedWorkspaceLoginRedirect,
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
      "/*",
      "!/",
      "!/login",
      "!/demo",
      "!/demo/*",
      "!/assets/*",
      "!/landing/*",
      "!/favicon.svg",
      "!/index.html",
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

  it.each([
    [401, "access-required"],
    [403, "not-authorized"],
  ])(
    "redirects a top-level HTML navigation after an authentication status %i",
    (status, reason) => {
      const response = protectedWorkspaceLoginRedirect(
        new Request(
          "https://rigstage.test/asset-review/draft/private_asset?asset=private_asset",
          { headers: { accept: "text/html,application/xhtml+xml" } },
        ),
        status,
      );

      expect(response?.status).toBe(302);
      expect(response?.headers.get("cache-control")).toBe("no-store");
      expect(response?.headers.get("location")).toBe(
        `https://rigstage.test/login?reason=${reason}&next=%2Fasset-review`,
      );
      expect(response?.headers.get("location")).not.toContain("private_asset");
    },
  );

  it("keeps API, AJAX and non-authentication failures as bounded responses", () => {
    expect(
      protectedWorkspaceLoginRedirect(
        new Request("https://rigstage.test/api/session", {
          headers: { accept: "application/json" },
        }),
        401,
      ),
    ).toBeNull();
    expect(
      protectedWorkspaceLoginRedirect(
        new Request("https://rigstage.test/dashboard", {
          headers: {
            accept: "text/html",
            "x-requested-with": "XMLHttpRequest",
          },
        }),
        401,
      ),
    ).toBeNull();
    expect(
      protectedWorkspaceLoginRedirect(
        new Request("https://rigstage.test/dashboard", {
          headers: { accept: "text/html" },
        }),
        500,
      ),
    ).toBeNull();
  });
});
