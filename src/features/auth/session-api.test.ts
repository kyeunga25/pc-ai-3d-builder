import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchSession, selectWorkspaceSession } from "./session-api";

const session = {
  user: {
    id: "user-fixture",
    email: "pilot@example.invalid",
    displayName: "Pilot Fixture",
  },
  currentWorkspace: {
    id: "workspace-beta",
    slug: "beta",
    name: "Beta",
    locale: "zh-Hant-HK",
    currency: "HKD",
    role: "admin" as const,
  },
  workspaces: [
    {
      id: "workspace-alpha",
      slug: "alpha",
      name: "Alpha",
      locale: "zh-Hant-HK",
      currency: "HKD",
      role: "owner" as const,
    },
    {
      id: "workspace-beta",
      slug: "beta",
      name: "Beta",
      locale: "zh-Hant-HK",
      currency: "HKD",
      role: "admin" as const,
    },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("session API", () => {
  it("loads the persisted workspace through a read-only request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(session));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchSession(new AbortController().signal),
    ).resolves.toMatchObject({ currentWorkspace: { id: "workspace-beta" } });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(url).toBe("/api/session");
    expect(init.method).toBeUndefined();
    expect(init.body).toBeUndefined();
    expect(headers.has("x-rigstage-workspace-id")).toBe(false);
  });

  it("persists an explicit workspace choice through a fixed PUT route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(session));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      selectWorkspaceSession(new AbortController().signal, "workspace-beta"),
    ).resolves.toMatchObject({ currentWorkspace: { id: "workspace-beta" } });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(url).toBe("/api/session/workspace");
    expect(url).not.toContain("workspace-beta");
    expect(init.method).toBe("PUT");
    expect(init.body).toBeUndefined();
    expect(headers.get("x-rigstage-workspace-id")).toBe("workspace-beta");
  });
});
