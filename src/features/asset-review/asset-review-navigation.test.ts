import { describe, expect, it } from "vitest";

import { targetAssetIdForWorkspace } from "./asset-review-navigation";

describe("asset review navigation target", () => {
  it("returns a transient target only inside its originating workspace", () => {
    const target = {
      workspaceId: "workspace-fixture-a",
      assetId: "asset-fixture-a",
    };

    expect(targetAssetIdForWorkspace(target, "workspace-fixture-a")).toBe(
      "asset-fixture-a",
    );
    expect(targetAssetIdForWorkspace(target, "workspace-fixture-b")).toBeNull();
    expect(targetAssetIdForWorkspace(null, "workspace-fixture-a")).toBeNull();
  });
});
