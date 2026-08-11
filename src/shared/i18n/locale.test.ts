import { describe, expect, it } from "vitest";

import { APP_LOCALE, formatHkd, splitBilingualMessage } from "./locale";

describe("香港繁體中文地區設定", () => {
  it("以香港繁體中文作為預設語言", () => {
    expect(APP_LOCALE).toBe("zh-Hant-HK");
  });

  it("以港幣符號及整數顯示目錄售價", () => {
    expect(formatHkd(549_900)).toBe("HK$5,499");
  });

  it("把公開 API 的合併訊息拆成獨立中英文內容", () => {
    expect(
      splitBilingualMessage(
        "檔案格式無效。 / The file format is invalid.",
        "Unable to process the file.",
      ),
    ).toEqual({
      zhHant: "檔案格式無效。",
      english: "The file format is invalid.",
    });
  });

  it("舊有單語訊息保留原文並使用安全英文後備", () => {
    expect(
      splitBilingualMessage(
        "暫時無法處理檔案。",
        "Unable to process the file.",
      ),
    ).toEqual({
      zhHant: "暫時無法處理檔案。",
      english: "Unable to process the file.",
    });
  });

  it("不信任上游的單語技術訊息並改用雙語安全後備", () => {
    expect(
      splitBilingualMessage(
        "upstream parser detail",
        "Unable to process the file.",
        "暫時無法處理檔案。",
      ),
    ).toEqual({
      zhHant: "暫時無法處理檔案。",
      english: "Unable to process the file.",
    });
  });
});
