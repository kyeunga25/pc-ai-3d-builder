import { describe, expect, it } from "vitest";

import {
  bilingualCommandBarTitle,
  builderAccountLabel,
  builderArchiveActionCopy,
  builderCommandBarCopy,
} from "./builder-command-bar-copy";

describe("Builder command bar copy", () => {
  it("keeps every static label bilingual", () => {
    for (const copy of Object.values(builderCommandBarCopy)) {
      expect(copy.zhHant).toMatch(/[\u3400-\u9fff]/u);
      expect(copy.english).toMatch(/[A-Za-z]/u);
    }
  });

  it("distinguishes archive preparation from confirmation", () => {
    expect(builderArchiveActionCopy(false)).toEqual(
      builderCommandBarCopy.archiveBuild,
    );
    expect(builderArchiveActionCopy(true)).toEqual(
      builderCommandBarCopy.confirmArchiveBuild,
    );
    expect(bilingualCommandBarTitle(builderArchiveActionCopy(true))).toContain(
      "Confirm archiving the current build",
    );
  });

  it("keeps the current account name inside a bilingual accessible label", () => {
    expect(builderAccountLabel("Synthetic Operator")).toBe(
      "Synthetic Operator 帳戶 / Synthetic Operator account",
    );
  });
});
