import { describe, expect, it } from "vitest";

import {
  isWorkspaceActivityCursor,
  normalizeWorkspaceActivityAction,
  safeWorkspaceActivityActorDisplayName,
  workspaceActivityCategoryForAction,
  workspaceActivityResponseSchema,
} from "./workspace-activity";

describe("workspace activity domain", () => {
  it("maps known actions to bounded public categories and hides unknown actions", () => {
    const action = normalizeWorkspaceActivityAction("asset.review.approve");
    expect(action).toBe("asset.review.approve");
    expect(workspaceActivityCategoryForAction(action)).toBe("asset");
    expect(normalizeWorkspaceActivityAction("asset.file.source.remove")).toBe(
      "asset.file.source.remove",
    );

    const unknown = normalizeWorkspaceActivityAction(
      "private.provider.coordinate.changed",
    );
    expect(unknown).toBe("other");
    expect(workspaceActivityCategoryForAction(unknown)).toBe("other");
  });

  it("keeps only bounded control-character-free actor display names", () => {
    expect(safeWorkspaceActivityActorDisplayName("  Synthetic Admin  ")).toBe(
      "Synthetic Admin",
    );
    expect(
      safeWorkspaceActivityActorDisplayName("Unsafe\u0000Name"),
    ).toBeNull();
    expect(safeWorkspaceActivityActorDisplayName("x".repeat(129))).toBeNull();
    expect(safeWorkspaceActivityActorDisplayName(null)).toBeNull();
  });

  it("accepts header-safe cursors and enforces a 50-item response page", () => {
    expect(isWorkspaceActivityCursor("event_fixture-1")).toBe(true);
    expect(isWorkspaceActivityCursor("event/private")).toBe(false);

    const item = {
      action: "build.create" as const,
      category: "build" as const,
      actorDisplayName: "Synthetic Admin",
      createdAt: "2026-08-30 00:00:00",
    };
    expect(
      workspaceActivityResponseSchema.safeParse({
        items: Array.from({ length: 50 }, () => item),
        nextCursor: "event_fixture-50",
      }).success,
    ).toBe(true);
    expect(
      workspaceActivityResponseSchema.safeParse({
        items: Array.from({ length: 51 }, () => item),
        nextCursor: null,
      }).success,
    ).toBe(false);
  });
});
