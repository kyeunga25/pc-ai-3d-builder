import { readFile } from "node:fs/promises";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { catalogParts } from "../../shared/domain/mockData";
import { AssetReviewNavigationProvider } from "../asset-review/AssetReviewNavigationProvider";
import {
  SessionContext,
  type SessionContextValue,
} from "../auth/session-context";
import { CataloguePage } from "./CataloguePage";

function renderPage(role: "owner" | "viewer" = "owner"): string {
  const currentWorkspace = {
    id: "workspace-catalogue-fixture",
    slug: "catalogue-fixture",
    name: "Synthetic Catalogue Workspace",
    locale: "zh-Hant-HK",
    currency: "HKD",
    role,
  };
  const sessionValue: SessionContextValue = {
    status: "authenticated",
    session: {
      user: {
        id: "user-catalogue-fixture",
        email: "catalogue-fixture@example.invalid",
        displayName: "Synthetic Catalogue Operator",
      },
      currentWorkspace,
      workspaces: [currentWorkspace],
    },
    error: null,
    workspaceSelection: {
      status: "idle",
      targetWorkspaceId: null,
      error: null,
    },
    dismissWorkspaceSelectionError() {},
    reload() {},
    selectWorkspace() {},
  };

  return renderToStaticMarkup(
    createElement(
      SessionContext.Provider,
      { value: sessionValue },
      createElement(
        MemoryRouter,
        { initialEntries: ["/catalogue"] },
        createElement(
          AssetReviewNavigationProvider,
          null,
          createElement(CataloguePage),
        ),
      ),
    ),
  );
}

describe("CataloguePage", () => {
  it("renders the catalogue workflow and every row state bilingually", () => {
    const markup = renderPage();

    expect(markup).toContain("Product catalogue");
    expect(markup).toContain("Human verification status");
    expect(markup).toContain("Check stock, specifications and human-approved");
    expect(markup).toContain("Search by SKU, brand, or model");
    expect(markup).toContain("All categories");
    expect(markup).toContain("Verified specifications only");
    expect(markup).toContain("Product");
    expect(markup).toContain("Category");
    expect(markup).toContain("Stock");
    expect(markup).toContain("3D asset");
    expect(markup).toContain("Price");
    expect(markup).toContain("In stock");
    expect(markup).toContain("Approved");
    expect(markup).toContain("View");
    expect(markup).toContain("Import CSV / TSV");
    expect(markup).toContain("CSV template");
    expect(markup).toContain("TSV template");
    expect(markup).toContain(
      'accept=".csv,.tsv,text/csv,text/tab-separated-values"',
    );
    expect(markup).toContain('aria-label="產品目錄篩選器 / Catalogue filters"');
    expect(markup).toContain('aria-label="產品目錄結果 / Catalogue results"');
    for (const part of catalogParts) {
      expect(markup).not.toContain(part.id);
      expect(markup).not.toContain(part.assetId ?? "__missing_asset_id__");
    }
  });

  it("keeps write controls disabled for viewers with bilingual guidance", () => {
    const markup = renderPage("viewer");

    expect(markup).toContain("The current role can only view the catalogue");
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>[^<]*<svg/gu);
    expect(markup).toContain("View");
  });

  it("wraps bilingual page copy and status at phone width", async () => {
    const styles = await readFile(
      new URL("./catalogue.css", import.meta.url),
      "utf8",
    );

    expect(styles).toMatch(
      /\.catalogue-page-copy\s*\{[^}]*overflow-wrap:\s*anywhere;/u,
    );
    expect(styles).toMatch(
      /\.catalogue-toolbar__notice\.catalogue-status\s*\{[^}]*white-space:\s*normal;/u,
    );
    expect(styles).toMatch(
      /@media \(max-width:\s*760px\)[\s\S]*\.catalogue-page \.page-header__actions \.button\s*\{[^}]*white-space:\s*normal;/u,
    );
  });
});
