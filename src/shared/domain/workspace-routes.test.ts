import { describe, expect, it } from "vitest";

import {
  defaultWorkspacePath,
  isProtectedWorkspacePath,
  safeWorkspaceReturnPath,
  workspaceDestinationLabel,
} from "./workspace-routes";

describe("workspace routes", () => {
  it.each([
    "/dashboard",
    "/dashboard/activity",
    "/catalogue",
    "/catalogue/part/example",
    "/asset-review?asset=synthetic",
    "/builder/build/synthetic#inspector",
  ])("accepts the protected return path %s", (path) => {
    expect(safeWorkspaceReturnPath(path)).toBe(path);
  });

  it.each([
    null,
    "",
    "/",
    "/login",
    "/demo/dashboard",
    "https://example.com/dashboard",
    "//example.com/dashboard",
    "/dashboard-public",
  ])("rejects the unsafe return path %s", (path) => {
    expect(safeWorkspaceReturnPath(path)).toBe(defaultWorkspacePath);
  });

  it("keeps route matching and destination labels bounded", () => {
    expect(isProtectedWorkspacePath("/asset-review/draft/example")).toBe(true);
    expect(isProtectedWorkspacePath("/asset-reviewer")).toBe(false);
    expect(workspaceDestinationLabel("/asset-review?asset=synthetic")).toBe(
      "3D 素材審核",
    );
    expect(workspaceDestinationLabel("/unknown")).toBe("商戶儀表板");
  });
});
