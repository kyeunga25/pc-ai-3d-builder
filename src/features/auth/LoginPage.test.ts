import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { LoginPage } from "./LoginPage";

const reasonExpectations = [
  {
    reason: "sign-in",
    titleChinese: "準備安全登入",
    titleEnglish: "Ready to sign in securely",
    descriptionEnglish: "No merchant data is loaded before sign-in",
  },
  {
    reason: "access-required",
    titleChinese: "需要先驗證 Access 身份",
    titleEnglish: "Cloudflare Access verification required",
    descriptionEnglish: "No merchant data was loaded",
  },
  {
    reason: "session-expired",
    titleChinese: "登入時段已結束",
    titleEnglish: "Your session has ended",
    descriptionEnglish: "No further merchant data was loaded",
  },
  {
    reason: "not-authorized",
    titleChinese: "此身份未獲工作區授權",
    titleEnglish: "This identity is not authorized",
    descriptionEnglish: "No merchant data was loaded",
  },
  {
    reason: "service-unavailable",
    titleChinese: "暫時無法完成身份檢查",
    titleEnglish: "Identity check is temporarily unavailable",
    descriptionEnglish: "No merchant data was loaded",
  },
] as const;

describe("LoginPage", () => {
  it.each(reasonExpectations)(
    "renders bilingual, fail-closed copy for $reason",
    ({ reason, titleChinese, titleEnglish, descriptionEnglish }) => {
      const markup = renderToStaticMarkup(
        createElement(
          MemoryRouter,
          {
            initialEntries: [`/login?reason=${reason}&next=%2Fbuilder`],
          },
          createElement(LoginPage),
        ),
      );

      expect(markup).toContain(titleChinese);
      expect(markup).toContain(titleEnglish);
      expect(markup).toContain('lang="en"');
      expect(markup).toContain(descriptionEnglish);
      expect(markup).toContain("電腦組裝");
    },
  );
});
