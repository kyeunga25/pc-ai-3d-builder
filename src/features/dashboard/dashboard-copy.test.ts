import { describe, expect, it } from "vitest";

import { relativeDashboardUpdateCopy } from "./dashboard-copy";

const now = Date.parse("2026-08-10T10:00:00.000Z");

describe("Dashboard relative update copy", () => {
  it.each([
    ["invalid", "最近更新", "Recently updated"],
    ["2026-08-10T09:59:40.000Z", "剛剛", "Just now"],
    ["2026-08-10T09:30:00.000Z", "30 分鐘前", "30 minutes ago"],
    ["2026-08-10 08:00:00", "2 小時前", "2 hours ago"],
    ["2026-08-07T10:00:00.000Z", "3 日前", "3 days ago"],
    ["2026-08-02T10:00:00.000Z", "較早更新", "Earlier update"],
  ])(
    "formats %s in Traditional Chinese and English",
    (value, zhHant, english) => {
      expect(relativeDashboardUpdateCopy(value, now)).toEqual({
        english,
        zhHant,
      });
    },
  );

  it("uses singular English units", () => {
    expect(
      relativeDashboardUpdateCopy("2026-08-10T09:59:00.000Z", now).english,
    ).toBe("1 minute ago");
    expect(
      relativeDashboardUpdateCopy("2026-08-10T09:00:00.000Z", now).english,
    ).toBe("1 hour ago");
    expect(
      relativeDashboardUpdateCopy("2026-08-09T10:00:00.000Z", now).english,
    ).toBe("1 day ago");
  });
});
