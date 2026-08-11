import { readFile } from "node:fs/promises";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { LoginPage } from "./LoginPage";

function renderLogin(initialEntry: string): string {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: [initialEntry] },
      createElement(LoginPage),
    ),
  );
}

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
      const markup = renderLogin(`/login?reason=${reason}&next=%2Fbuilder`);

      expect(markup).toContain(titleChinese);
      expect(markup).toContain(titleEnglish);
      expect(markup).toContain('lang="en"');
      expect(markup).toContain(descriptionEnglish);
      expect(markup).toContain("電腦組裝");
    },
  );

  it("renders the complete login workflow bilingually", () => {
    const markup = renderLogin("/login?reason=sign-in&next=%2Fbuilder");

    for (const expected of [
      "Invite-only workspace",
      "Sign in to your RigStage workspace",
      "Continue managing your product catalogue",
      "Login security boundaries",
      "Cloudflare Access verifies identity first",
      "The server then checks the invitation and active membership",
      "No private workspace data loads when verification fails",
      "After sign-in, go to",
      "PC builder",
      "Continue with Cloudflare Access",
      "Only invited Beta Access users are accepted",
      "Return to the RigStage public home page",
      "Private data stays locked when verification fails",
    ]) {
      expect(markup).toContain(expected);
    }
    expect(markup).toContain(
      'aria-label="返回 RigStage 公開主頁 / Return to the RigStage public home page"',
    );
    expect(markup).toContain(
      'aria-label="登入安全邊界 / Login security boundaries"',
    );
    expect(markup).toContain(
      'aria-label="使用 Cloudflare Access 繼續 / Continue with Cloudflare Access"',
    );
  });

  it("labels the fixed destination without rendering a dynamic target", () => {
    const markup = renderLogin(
      "/login?reason=sign-in&next=%2Fbuilder%2Fbuild%2Fprivate_build%3Fmember%3Dprivate_user",
    );

    expect(markup).toContain('href="/builder"');
    expect(markup).toContain("電腦組裝工作台");
    expect(markup).toContain("PC builder");
    expect(markup).not.toContain("private_build");
    expect(markup).not.toContain("private_user");
  });

  it("explains the authorization recovery action bilingually", () => {
    const markup = renderLogin(
      "/login?reason=not-authorized&next=%2Fdashboard",
    );

    expect(markup).toContain("先登出目前的 Access 身份");
    expect(markup).toContain("Sign out of the current Access identity first");
    expect(markup).toContain('href="/cdn-cgi/access/logout"');
    expect(markup).toContain(
      'aria-label="先登出目前的 Access 身份 / Sign out of the current Access identity first"',
    );
  });

  it("wraps bilingual login copy and the primary action at phone width", async () => {
    const styles = await readFile(
      new URL("./auth.css", import.meta.url),
      "utf8",
    );

    expect(styles).toMatch(
      /\.auth-bilingual-copy\s*\{[^}]*overflow-wrap:\s*anywhere;/u,
    );
    expect(styles).toMatch(
      /\.auth-card__primary\s*\{[^}]*white-space:\s*normal;/u,
    );
    expect(styles).toMatch(
      /@media \(max-width:\s*560px\)[\s\S]*\.auth-page__main\s*\{[^}]*padding:\s*72px 18px 64px;/u,
    );
  });
});
