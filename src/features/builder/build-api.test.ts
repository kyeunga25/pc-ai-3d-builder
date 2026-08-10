import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchBuild, fetchBuildExport, mutateBuild } from "./build-api";

const buildFixture = {
  id: "build-private-fixture",
  name: "私人組裝測試",
  status: "draft" as const,
  selectedParts: [],
  findings: [],
  summary: {
    passCount: 0,
    warningCount: 0,
    errorCount: 0,
    unknownCount: 0,
  },
  totalPriceMinor: 0,
  version: 2,
  updatedAt: "2026-08-10T00:00:00Z",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("build target API", () => {
  it("uses fixed URLs and keeps the private build ID in one header", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(buildFixture))
      .mockResolvedValueOnce(Response.json(buildFixture))
      .mockResolvedValueOnce(
        new Response('{"schemaVersion":2}', {
          headers: { "content-type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await fetchBuild(
      new AbortController().signal,
      "workspace-fixture",
      buildFixture.id,
    );
    await mutateBuild("workspace-fixture", buildFixture.id, {
      action: "update",
      expectedVersion: 2,
      name: "私人組裝測試",
      selectedPartIds: [],
    });
    await fetchBuildExport("workspace-fixture", buildFixture.id);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/build",
      "/api/build",
      "/api/build/export",
    ]);
    for (const [url, init] of fetchMock.mock.calls as Array<
      [string, RequestInit]
    >) {
      const headers = new Headers(init.headers);
      expect(url).not.toContain(buildFixture.id);
      expect(headers.get("x-rigstage-build-id")).toBe(buildFixture.id);
      expect(headers.get("x-rigstage-workspace-id")).toBe("workspace-fixture");
      expect(headers.get("x-requested-with")).toBe("XMLHttpRequest");
      expect(String(init.body ?? "")).not.toContain(buildFixture.id);
    }
  });
});
