import { readFile } from "node:fs/promises";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  demoEntryPath,
  heroProofPoints,
  trustPoints,
  useCases,
  workflowCases,
  workspaceEntryPath,
} from "./landing-content";
import { landingEntryCopy } from "./landing-entry-copy";
import { LandingPage } from "./LandingPage";

describe("LandingPage", () => {
  it("describes the product through verified workspace workflows", () => {
    expect(landingEntryCopy.heroTitle.zhHant).toContain("每一步都有證據");
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
    expect(heroProofPoints.map((point) => point.zhHant)).toContain(
      "素材經人手核准後才可使用",
    );
    expect(
      trustPoints.find((point) => point.title.zhHant === "相容性有結構化證據")
        ?.description.zhHant,
    ).toContain("不以 3D 外觀作推斷");
    expect(workspaceEntryPath).toBe("/login?next=%2Fdashboard");
    expect(demoEntryPath).toBe("/demo/dashboard");
  });

  it("renders the public entry, synthetic-data and sign-in boundaries bilingually", () => {
    const markup = renderToStaticMarkup(createElement(LandingPage));

    for (const expected of [
      "Homepage navigation",
      "Workflow",
      "Use cases",
      "Data boundaries",
      "Sign in to workspace",
      "From component data to a deliverable build",
      "Try the synthetic demo",
      "Sign in to invited workspace",
      "Every record is isolated by workspace",
      "Synthetic demo workspace",
      "Enlarge interface",
      "Visual material is not compatibility evidence",
      "Keep public product information separate",
      "Invite-only workspaces",
      "Private assets stay private",
      "Invited already? Continue from your workspace",
      "Workspace screens use synthetic demo data",
    ]) {
      expect(markup).toContain(expected);
    }
    expect(markup).toContain('aria-label="主頁導覽 / Homepage navigation"');
    expect(markup).toContain('aria-label="產品重點 / Product highlights"');
  });

  it("keeps every public landing link local and identifier-free", () => {
    const markup = renderToStaticMarkup(createElement(LandingPage));
    const hrefs = [...markup.matchAll(/href="([^"]+)"/gu)].map(
      (match) => match[1]!,
    );

    expect(hrefs.length).toBeGreaterThan(10);
    for (const href of hrefs) {
      expect(href).toMatch(/^(?:\/|#)/u);
      expect(href).not.toContain("private_");
      expect(href).not.toContain("workspace=");
    }
  });

  it("wraps bilingual landing copy and actions at phone width", async () => {
    const styles = await readFile(
      new URL("./landing.css", import.meta.url),
      "utf8",
    );

    expect(styles).toMatch(
      /\.landing-bilingual-copy\s*\{[^}]*overflow-wrap:\s*anywhere;/u,
    );
    expect(styles).toMatch(
      /\.landing-button,[\s\S]*\.landing-login-link,[\s\S]*\.landing-text-link\s*\{[^}]*white-space:\s*normal;/u,
    );
    expect(styles).toMatch(
      /@media \(max-width:\s*680px\)[\s\S]*\.landing-button\s*\{[^}]*width:\s*100%;/u,
    );
    expect(styles).not.toContain(".landing-footer span:first-child");
    expect(styles).toContain(
      ".landing-footer > .landing-bilingual-copy:first-child",
    );
    expect(styles).toMatch(
      /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*\.landing-hero__copy,[\s\S]*\.landing-hero__product\s*\{[^}]*animation:\s*none;/u,
    );
  });
});
