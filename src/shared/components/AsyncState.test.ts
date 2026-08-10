import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { EmptyState, ErrorState, LoadingState } from "./AsyncState";

describe("shared async states", () => {
  it("renders a bilingual loading status", () => {
    const markup = renderToStaticMarkup(
      createElement(LoadingState, {
        label: "正在驗證商戶身份",
        labelEnglish: "Verifying merchant identity",
      }),
    );

    expect(markup).toContain('role="status"');
    expect(markup).toContain("正在驗證商戶身份");
    expect(markup).toContain('lang="en"');
    expect(markup).toContain("Verifying merchant identity");
    expect(markup).toContain("Preparing verified merchant data.");
  });

  it("renders a bilingual failure and retry action", () => {
    const markup = renderToStaticMarkup(
      createElement(ErrorState, {
        title: "無法載入素材審核佇列",
        titleEnglish: "Unable to load the asset review queue",
        onRetry: vi.fn(),
      }),
    );

    expect(markup).toContain('role="alert"');
    expect(markup).toContain("無法載入素材審核佇列");
    expect(markup).toContain("Unable to load the asset review queue");
    expect(markup).toContain("商戶資料未有任何變更。");
    expect(markup).toContain("No merchant data was changed.");
    expect(markup).toContain("重試");
    expect(markup).toContain("Retry");
  });

  it("renders a bilingual empty state without implying a write", () => {
    const markup = renderToStaticMarkup(
      createElement(EmptyState, {
        title: "目前沒有組裝草稿",
        titleEnglish: "No build drafts yet",
        message: "讀取空清單不會自動建立資料。",
        messageEnglish: "Reading an empty list does not create data.",
      }),
    );

    expect(markup).toContain("目前沒有組裝草稿");
    expect(markup).toContain("No build drafts yet");
    expect(markup).toContain("讀取空清單不會自動建立資料。");
    expect(markup).toContain("Reading an empty list does not create data.");
    expect(markup).toContain('lang="en"');
  });
});
