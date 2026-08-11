import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchCataloguePage, mutateCataloguePart } from "./catalogue-api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("catalogue pagination API", () => {
  it("replays the same private cursor only through the protected header", async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        Response.json({
          items: [],
          nextCursor: null,
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      Promise.all([
        fetchCataloguePage(
          new AbortController().signal,
          "workspace-fixture",
          "part-private-fixture",
        ),
        fetchCataloguePage(
          new AbortController().signal,
          "workspace-fixture",
          "part-private-fixture",
        ),
      ]),
    ).resolves.toEqual([
      { items: [], nextCursor: null },
      { items: [], nextCursor: null },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const call of fetchMock.mock.calls) {
      const [url, init] = call as [string, RequestInit];
      const headers = new Headers(init.headers);
      expect(url).toBe("/api/catalogue?limit=100");
      expect(url).not.toContain("part-private-fixture");
      expect(url).not.toContain("cursor=");
      expect(headers.get("x-rigstage-catalogue-cursor")).toBe(
        "part-private-fixture",
      );
      expect(headers.get("x-rigstage-workspace-id")).toBe("workspace-fixture");
      expect(headers.get("x-requested-with")).toBe("XMLHttpRequest");
      expect(init.body).toBeUndefined();
    }
  });

  it("omits the cursor header on the first page", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ items: [], nextCursor: null }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchCataloguePage(new AbortController().signal, "workspace-fixture");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).has("x-rigstage-catalogue-cursor")).toBe(
      false,
    );
  });
});

describe("catalogue part target API", () => {
  it("keeps the private part ID out of the mutation URL and body", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      mutateCataloguePart("workspace-fixture", "part-private-fixture", {
        action: "archive",
        expectedVersion: 3,
      }),
    ).resolves.toBeNull();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(url).toBe("/api/catalogue/part");
    expect(url).not.toContain("part-private-fixture");
    expect(String(init.body)).not.toContain("part-private-fixture");
    expect(headers.get("x-rigstage-catalogue-part-id")).toBe(
      "part-private-fixture",
    );
    expect(headers.get("x-rigstage-workspace-id")).toBe("workspace-fixture");
    expect(headers.get("x-requested-with")).toBe("XMLHttpRequest");
  });
});
