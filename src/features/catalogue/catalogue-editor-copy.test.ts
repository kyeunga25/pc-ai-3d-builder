import { describe, expect, it } from "vitest";

import {
  catalogueEditorCopy,
  catalogueEditorTitleCopy,
  catalogueEditorVersionCopy,
} from "./catalogue-editor-copy";

const bilingualCopyPattern = {
  english: /[A-Za-z]/u,
  zhHant: /[\u3400-\u9fff]/u,
};

describe("Catalogue editor copy", () => {
  it("keeps every editor label and operation state bilingual", () => {
    expect(Object.keys(catalogueEditorCopy)).toHaveLength(28);
    for (const [key, copy] of Object.entries(catalogueEditorCopy)) {
      expect(copy.english).toMatch(bilingualCopyPattern.english);
      if (key !== "sku") {
        expect(copy.zhHant).toMatch(bilingualCopyPattern.zhHant);
      }
    }

    expect(catalogueEditorCopy.archiveProduct.english).toBe("Archive product");
    expect(catalogueEditorCopy.confirmArchive.english).toBe("Confirm archive");
    expect(catalogueEditorCopy.archiving.english).toBe("Archiving…");
    expect(catalogueEditorCopy.assetDraftFileRequirements.english).toContain(
      "filename, MIME and content",
    );
    expect(catalogueEditorCopy.unverifiedSpecification.english).toBe(
      "Unverified",
    );
    expect(catalogueEditorCopy.humanVerifiedSpecification.english).toBe(
      "Human verified",
    );
  });

  it("selects the correct create, edit and view headings", () => {
    expect(catalogueEditorTitleCopy(false, false)).toBe(
      catalogueEditorCopy.addProduct,
    );
    expect(catalogueEditorTitleCopy(true, false)).toBe(
      catalogueEditorCopy.editProduct,
    );
    expect(catalogueEditorTitleCopy(true, true)).toBe(
      catalogueEditorCopy.viewProduct,
    );
    expect(catalogueEditorVersionCopy(7)).toEqual({
      english: "Version 7",
      zhHant: "版本 7",
    });
  });
});
