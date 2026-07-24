import { describe, expect, it } from "vitest";

import { APP_LOCALE, formatHkd } from "./locale";

describe("香港繁體中文地區設定", () => {
  it("以香港繁體中文作為預設語言", () => {
    expect(APP_LOCALE).toBe("zh-Hant-HK");
  });

  it("以港幣符號及整數顯示目錄售價", () => {
    expect(formatHkd(549_900)).toBe("HK$5,499");
  });
});
