import { describe, expect, it } from "vitest";

import {
  landingCopy,
  trustPoints,
  workflowSteps,
  workspaceEntryPath,
} from "./landing-content";

describe("LandingPage", () => {
  it("keeps the public product claims and protected workspace entry explicit", () => {
    expect(landingCopy.heroTitle).toContain("零件資料、3D 素材與組裝決策");
    expect(workflowSteps.map((step) => step.title)).toEqual([
      "產品目錄",
      "素材審核",
      "組裝與相容性",
      "安全匯出",
    ]);
    expect(
      trustPoints.find((point) => point.title === "核實規格")?.description,
    ).toContain("絕不從視覺模型推斷");
    expect(workspaceEntryPath).toBe("/dashboard");
  });
});
