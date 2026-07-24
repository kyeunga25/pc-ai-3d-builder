import { describe, expect, it } from "vitest";

import { accountInitials, sessionResponseSchema } from "./session";

describe("session domain contract", () => {
  it("requires the current workspace to be included in the membership list", () => {
    const workspace = {
      id: "ws_pilot",
      slug: "pilot-shop",
      name: "試行商戶",
      locale: "zh-Hant-HK",
      currency: "HKD",
      role: "owner" as const,
    };

    const session = sessionResponseSchema.parse({
      user: {
        id: "user_pilot",
        email: "pilot@example.com",
        displayName: "試行用戶",
      },
      currentWorkspace: workspace,
      workspaces: [workspace],
    });

    expect(session.workspaces).toContainEqual(session.currentWorkspace);
  });

  it("creates compact account initials without exposing the full email", () => {
    expect(accountInitials("Merchant Operator", "merchant@example.com")).toBe(
      "MO",
    );
  });
});
