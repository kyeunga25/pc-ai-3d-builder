import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CatalogueStatusView } from "./CatalogueStatusView";
import { catalogueStatusCopy } from "./catalogue-status";

describe("Catalogue status announcement", () => {
  it("announces failures as alerts without a success icon", () => {
    const markup = renderToStaticMarkup(
      createElement(CatalogueStatusView, {
        status: catalogueStatusCopy.importFailed,
      }),
    );

    expect(markup).toContain('class="catalogue-status is-error"');
    expect(markup).toContain('role="alert"');
    expect(markup).toContain("lucide-circle-alert");
    expect(markup).not.toContain("lucide-circle-check");
  });

  it("uses a polite warning state for archive confirmation", () => {
    const markup = renderToStaticMarkup(
      createElement(CatalogueStatusView, {
        status: catalogueStatusCopy.confirmArchive,
      }),
    );

    expect(markup).toContain('class="catalogue-status is-warning"');
    expect(markup).toContain('role="status"');
    expect(markup).toContain("lucide-triangle-alert");
  });
});
