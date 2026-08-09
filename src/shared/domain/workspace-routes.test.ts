import { describe, expect, it } from "vitest";

import {
  defaultWorkspacePath,
  isProtectedWorkspacePath,
  safeWorkspaceLoginReturnPath,
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
    expect(isProtectedWorkspacePath("/Asset-Review/Draft/example")).toBe(true);
    expect(isProtectedWorkspacePath("/DASHBOARD")).toBe(true);
    expect(isProtectedWorkspacePath("/asset-reviewer")).toBe(false);
    expect(isProtectedWorkspacePath("/DASHBOARD-PUBLIC")).toBe(false);
    expect(workspaceDestinationLabel("/asset-review?asset=synthetic")).toBe(
      "3D 素材審核",
    );
    expect(workspaceDestinationLabel("/BUILDER#inspector")).toBe(
      "電腦組裝工作台",
    );
    expect(workspaceDestinationLabel("/unknown")).toBe("商戶儀表板");
  });

  it.each([
    ["/dashboard/activity?member=private_user#recent", "/dashboard"],
    ["/catalogue/part/private_part", "/catalogue"],
    [
      "/asset-review/draft/private_asset?workspace=private_workspace",
      "/asset-review",
    ],
    ["/builder/build/private_build#inspector", "/builder"],
    ["/CaTaLoGuE/part/private_part", "/catalogue"],
  ])(
    "removes dynamic identifiers from the public login return path %s",
    (path, expected) => {
      const returnPath = safeWorkspaceLoginReturnPath(path);

      expect(returnPath).toBe(expected);
      expect(returnPath).not.toContain("private_");
      expect(returnPath).not.toContain("?");
      expect(returnPath).not.toContain("#");
    },
  );

  it("falls back to the dashboard for an unsafe public login return path", () => {
    expect(
      safeWorkspaceLoginReturnPath("https://example.com/asset-review"),
    ).toBe(defaultWorkspacePath);
  });
});
