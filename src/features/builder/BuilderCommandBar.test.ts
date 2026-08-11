import { readFile } from "node:fs/promises";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { SessionContext } from "../auth/session-context";
import {
  BuilderCommandBar,
  BuilderOperationStatusView,
} from "./BuilderCommandBar";
import { builderStatusCopy } from "./builder-status";

const currentWorkspace = {
  id: "workspace-command-fixture",
  slug: "command-fixture",
  name: "Synthetic Command Workspace",
  locale: "zh-Hant-HK",
  currency: "HKD",
  role: "owner" as const,
};

const sessionValue = {
  status: "authenticated" as const,
  session: {
    user: {
      id: "user-command-fixture",
      email: "command-fixture@example.invalid",
      displayName: "Synthetic Operator",
    },
    currentWorkspace,
    workspaces: [currentWorkspace],
  },
  error: null,
  workspaceSelection: {
    status: "idle" as const,
    targetWorkspaceId: null,
    error: null,
  },
  dismissWorkspaceSelectionError() {},
  reload() {},
  selectWorkspace() {},
};

const build = {
  id: "build-command-fixture",
  name: "Synthetic test build",
  selectedCount: 2,
  version: 3,
  updatedAt: "2026-08-10T00:00:00Z",
};

function renderCommandBar({
  archiveArmed = false,
  canWrite = true,
}: {
  archiveArmed?: boolean;
  canWrite?: boolean;
} = {}): string {
  return renderToStaticMarkup(
    createElement(
      SessionContext.Provider,
      { value: sessionValue },
      createElement(
        MemoryRouter,
        { initialEntries: ["/builder"] },
        createElement(BuilderCommandBar, {
          saveState: builderStatusCopy.localBuildLoaded,
          buildName: build.name,
          buildId: build.id,
          builds: [build],
          canWrite,
          archiveArmed,
          onBuildNameChange() {},
          onBuildSelect() {},
          onCreateBuild() {},
          onArchiveBuild() {},
          onOpenInspector() {},
        }),
      ),
    ),
  );
}

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

describe("Builder command bar controls", () => {
  it("labels navigation, context and critical actions bilingually", () => {
    const markup = renderCommandBar();

    expect(markup).toContain("Workspace");
    expect(markup).toContain("Current build");
    expect(markup).toContain('aria-label="組裝名稱 / Build name"');
    expect(markup).toContain('aria-label="建立新組裝 / Create new build"');
    expect(markup).toContain(
      'aria-label="封存目前組裝 / Archive the current build"',
    );
    expect(markup).toContain('aria-label="檢查器 / Inspector"');
    expect(markup).toContain('<span lang="en">Inspector</span>');
    expect(markup).toContain(
      'aria-label="返回商戶 Dashboard / Return to merchant dashboard"',
    );
    expect(markup).toContain(
      'aria-label="Synthetic Operator 帳戶 / Synthetic Operator account"',
    );
  });

  it("uses the armed archive confirmation and withholds writes from viewers", () => {
    const armedMarkup = renderCommandBar({ archiveArmed: true });
    const viewerMarkup = renderCommandBar({ canWrite: false });

    expect(armedMarkup).toContain(
      'aria-label="確認封存目前組裝 / Confirm archiving the current build"',
    );
    expect(armedMarkup).toContain(
      'title="再次按下以確認封存 / Press again to confirm archive"',
    );
    expect(viewerMarkup).not.toContain("command-new-build");
    expect(viewerMarkup).not.toContain("command-archive-build");
    expect(viewerMarkup).toMatch(/<input[^>]*disabled=""/u);
    expect(viewerMarkup).toContain('aria-label="檢查器 / Inspector"');
  });

  it("wraps bilingual labels while retaining compact icon actions", async () => {
    const styles = await readFile(
      new URL("./builder.css", import.meta.url),
      "utf8",
    );

    expect(styles).toMatch(
      /\.command-bar-copy\s*\{[^}]*overflow-wrap:\s*anywhere;/u,
    );
    expect(styles).toMatch(
      /@media \(max-width:\s*520px\)[\s\S]*\.command-inspector-button\s*\{[^}]*font-size:\s*0;/u,
    );
  });
});
