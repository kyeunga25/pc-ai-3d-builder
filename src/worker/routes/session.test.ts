import { describe, expect, it } from "vitest";

import { sessionResponse } from "./session";

describe("session response", () => {
  it("returns workspace context without writing on a read-only request", async () => {
    const response = sessionResponse({
      user: {
        id: "user-1",
        email: "pilot@example.com",
        displayName: "Pilot",
      },
      currentWorkspace: {
        id: "workspace-1",
        slug: "pilot",
        name: "Pilot",
        locale: "zh-Hant-HK",
        currency: "HKD",
        role: "owner",
      },
      workspaces: [],
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({
      currentWorkspace: { id: "workspace-1" },
    });
  });
});
