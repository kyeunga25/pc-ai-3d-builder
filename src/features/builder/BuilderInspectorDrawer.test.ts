import { readFile } from "node:fs/promises";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { catalogParts } from "../../shared/domain/mockData";
import { BuilderInspectorDrawer } from "./BuilderInspectorDrawer";

describe("BuilderInspectorDrawer", () => {
  it("renders a bilingual labelled modal without exposing the private asset id", () => {
    const part = catalogParts[0];
    if (!part) {
      throw new Error("Synthetic catalogue fixture is missing.");
    }
    const markup = renderToStaticMarkup(
      createElement(BuilderInspectorDrawer, {
        part,
        findings: [],
        onClose() {},
      }),
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain("aria-labelledby=");
    expect(markup).toContain('tabindex="-1"');
    expect(markup).toContain("組裝檢查器");
    expect(markup).toContain('<span lang="en">Build inspector</span>');
    expect(
      markup.match(/aria-label="關閉檢查器 \/ Close inspector"/gu),
    ).toHaveLength(2);
    expect(markup).not.toContain(part.assetId ?? "__missing_asset_id__");
  });

  it("wraps the bilingual drawer heading at compact widths", async () => {
    const styles = await readFile(
      new URL("./builder.css", import.meta.url),
      "utf8",
    );

    expect(styles).toMatch(
      /\.inspector-drawer-copy\s*\{[^}]*overflow-wrap:\s*anywhere;/u,
    );
    expect(styles).toMatch(
      /\.inspector-drawer\s*\{[^}]*overscroll-behavior:\s*contain;/u,
    );
  });
});
