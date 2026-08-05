import { afterEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "./api-fetch";

describe("apiFetch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("marks protected SPA requests as AJAX for expired Access sessions", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/api/session", {
      headers: { accept: "application/json" },
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(init.credentials).toBe("same-origin");
    expect(headers.get("accept")).toBe("application/json");
    expect(headers.get("x-requested-with")).toBe("XMLHttpRequest");
  });

  it("preserves an explicitly stricter credential mode", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/api/health", { credentials: "omit" });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.credentials).toBe("omit");
  });
});
