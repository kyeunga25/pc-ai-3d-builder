import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BuilderOperationStatusView } from "./BuilderCommandBar";
import { builderStatusCopy } from "./builder-status";

describe("Builder operation status announcement", () => {
  it("announces failures as an alert instead of a success check", () => {
    const markup = renderToStaticMarkup(
      createElement(BuilderOperationStatusView, {
        status: builderStatusCopy.saveFailed,
      }),
    );

    expect(markup).toContain('class="command-save-state is-error"');
    expect(markup).toContain('role="alert"');
    expect(markup).toContain("lucide-circle-alert");
    expect(markup).not.toContain("lucide-circle-check");
    expect(markup).toContain(builderStatusCopy.saveFailed.message);
  });

  it("uses a polite warning state for the second archive confirmation", () => {
    const markup = renderToStaticMarkup(
      createElement(BuilderOperationStatusView, {
        status: builderStatusCopy.confirmArchive,
      }),
    );

    expect(markup).toContain('class="command-save-state is-warning"');
    expect(markup).toContain('role="status"');
    expect(markup).toContain("lucide-triangle-alert");
    expect(markup).toContain(
      `title="${builderStatusCopy.confirmArchive.message}"`,
    );
  });
});
