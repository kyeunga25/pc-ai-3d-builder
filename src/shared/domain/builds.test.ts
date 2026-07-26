import { describe, expect, it } from "vitest";

import { catalogParts, currentBuild } from "./mockData";
import {
  buildRecordSchema,
  composeBuildRecord,
  evaluateBuildCompatibility,
  isBuildExportReady,
  portableBuildExport,
} from "./builds";

describe("build compatibility", () => {
  const selectedFixtureParts = catalogParts.filter((part) =>
    currentBuild.selectedPartIds.includes(part.id),
  );

  it("evaluates a complete verified fixture without errors or unknown rules", () => {
    const build = composeBuildRecord({
      id: "build-fixture",
      name: "完整測試組裝",
      status: "draft",
      selectedParts: selectedFixtureParts,
      version: 0,
      updatedAt: "2026-07-26T00:00:00Z",
    });

    expect(build.selectedParts).toHaveLength(9);
    expect(build.summary).toMatchObject({
      errorCount: 0,
      unknownCount: 0,
      warningCount: 0,
      passCount: 6,
    });
    expect(isBuildExportReady(build)).toBe(true);
  });

  it("reports verified socket mismatches as hard errors", () => {
    const parts = catalogParts
      .filter(
        (part) => part.category === "cpu" || part.category === "motherboard",
      )
      .map((part) =>
        part.category === "cpu"
          ? {
              ...part,
              specifications: { ...part.specifications, socket: "LGA1851" },
            }
          : part,
      );

    expect(evaluateBuildCompatibility(parts)).toContainEqual(
      expect.objectContaining({
        ruleId: "cpu_socket",
        severity: "error",
      }),
    );
  });

  it("fails closed when required structured specifications are unverified", () => {
    const parts = catalogParts
      .filter((part) => part.category === "gpu" || part.category === "case")
      .map((part) =>
        part.category === "gpu"
          ? { ...part, specificationStatus: "unverified" as const }
          : part,
      );

    expect(evaluateBuildCompatibility(parts)).toContainEqual(
      expect.objectContaining({
        ruleId: "gpu_clearance",
        severity: "unknown",
      }),
    );
  });

  it("exports a portable boundary without operational or private fields", () => {
    const build = buildRecordSchema.parse(
      composeBuildRecord({
        id: "build-private-id",
        name: "可攜測試組裝",
        status: "draft",
        selectedParts: selectedFixtureParts,
        version: 3,
        updatedAt: "2026-07-26T00:00:00Z",
      }),
    );
    const serialized = JSON.stringify(portableBuildExport(build));

    expect(serialized).not.toContain("build-private-id");
    expect(serialized).not.toContain("priceMinor");
    expect(serialized).not.toContain("stockStatus");
    expect(serialized).not.toContain("assetId");
    expect(serialized).not.toContain("workspaceId");
    expect(serialized).not.toContain("objectKey");
    expect(serialized).toContain("相容性只來自已核實的結構化規格");
  });
});
