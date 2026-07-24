import { describe, expect, it } from "vitest";

import { catalogParts, currentBuild } from "./mockData";
import { catalogPartSchema, mockBuildSchema } from "./schemas";

describe("domain fixtures", () => {
  it("keeps every mock catalogue row inside the shared schema", () => {
    expect(() =>
      catalogParts.map((part) => catalogPartSchema.parse(part)),
    ).not.toThrow();
  });

  it("represents the reviewable mock build without a hard error", () => {
    const build = mockBuildSchema.parse(currentBuild);

    expect(build.hardErrorCount).toBe(0);
    expect(build.warningCount).toBe(1);
    expect(build.totalPriceMinor).toBeGreaterThan(0);
  });
});
