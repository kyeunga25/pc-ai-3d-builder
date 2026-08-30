import { afterEach, describe, expect, it, vi } from "vitest";

import { workspaceActivityCursorHeader } from "../../shared/lib/workspace-activity-pagination";
import { fetchWorkspaceActivityPage } from "./workspace-activity-api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("workspace activity API", () => {
  it("keeps the private page cursor in a fixed protected header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        items: [],
        nextCursor: null,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchWorkspaceActivityPage(
        new AbortController().signal,
        "workspace_private_fixture",
        "event_private_cursor",
      ),
    ).resolves.toEqual({ items: [], nextCursor: null });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(url).toBe("/api/workspace/activity");
    expect(url).not.toContain("workspace_private_fixture");
    expect(url).not.toContain("event_private_cursor");
    expect(headers.get("x-rigstage-workspace-id")).toBe(
      "workspace_private_fixture",
    );
    expect(headers.get(workspaceActivityCursorHeader)).toBe(
      "event_private_cursor",
    );
    expect(headers.get("x-requested-with")).toBe("XMLHttpRequest");
  });

  it("omits the cursor header from the first-page request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        items: [],
        nextCursor: null,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await fetchWorkspaceActivityPage(
      new AbortController().signal,
      "workspace_private_fixture",
    );

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).has(workspaceActivityCursorHeader)).toBe(
      false,
    );
  });
});
