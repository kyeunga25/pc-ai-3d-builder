import { describe, expect, it } from "vitest";

import {
  heroProofPoints,
  landingCopy,
  trustPoints,
  useCases,
  workflowCases,
  workspaceEntryPath,
} from "./landing-content";

describe("LandingPage", () => {
  it("describes the product through verified workspace workflows", () => {
    expect(landingCopy.heroTitle).toContain("每一步都有證據");
    expect(workflowCases.map((workflowCase) => workflowCase.label)).toEqual([
      "每日工作入口",
      "新貨與目錄維護",
      "私人素材審核",
    ]);
    expect(
      workflowCases.flatMap((workflowCase) => workflowCase.points).join(" "),
    ).toContain("相容性");
    expect(useCases.map((useCase) => useCase.title)).toEqual([
      "新產品上架",
      "客製化配機",
      "素材交付與覆核",
    ]);
  });

  it("uses only local synthetic workspace screenshots", () => {
    expect(
      workflowCases.every(
        (workflowCase) =>
          workflowCase.image.startsWith("/landing/workspace-") &&
          workflowCase.image.endsWith(".jpg"),
      ),
    ).toBe(true);
    expect(
      new Set(workflowCases.map((workflowCase) => workflowCase.image)).size,
    ).toBe(workflowCases.length);
  });

  it("keeps invite-only and private-workspace boundaries explicit", () => {
    expect(heroProofPoints).toContain("素材經人手核准後才可使用");
    expect(
      trustPoints.find((point) => point.title === "相容性有結構化證據")
        ?.description,
    ).toContain("不以 3D 外觀作推斷");
    expect(workspaceEntryPath).toBe("/dashboard");
  });
});
