import { describe, expect, it } from "vitest";

import { sessionResponse, workspaceSelectionResponse } from "./session";

const context = {
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
    role: "owner" as const,
  },
  workspaces: [],
};

describe("session response", () => {
  it("returns workspace context without writing on a read-only request", async () => {
    const response = sessionResponse(context);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({
      currentWorkspace: { id: "workspace-1" },
    });
  });

  it("persists only an explicit workspace selection before responding", async () => {
    const writes: unknown[][] = [];
    const db = {
      prepare() {
        return {
          bind(...values: unknown[]) {
            return {
              async run() {
                writes.push(values);
                return { success: true, meta: { changes: 1 } };
              },
            };
          },
        };
      },
    } as unknown as D1Database;

    const response = await workspaceSelectionResponse(
      db,
      context,
      "access-subject-1",
    );

    expect(writes).toEqual([["workspace-1", "user-1", "access-subject-1"]]);
    const body = await response.json();
    expect(body).toMatchObject({
      currentWorkspace: { id: "workspace-1" },
    });
    expect(JSON.stringify(body)).not.toContain("access-subject-1");
  });
});
