import { describe, expect, it } from "vitest";

import {
  catalogueImportMaxBytes,
  catalogueImportTemplates,
} from "../../shared/domain/catalogue-import";
import { validateCatalogueImportFile } from "./catalogue-import-file";

describe("catalogue import file preflight", () => {
  it("validates a TSV file before upload", async () => {
    const file = new File(
      [catalogueImportTemplates.tsv],
      "synthetic-catalogue.tsv",
      { type: "text/tab-separated-values" },
    );

    await expect(validateCatalogueImportFile(file)).resolves.toMatchObject({
      format: "tsv",
      inputs: [{ sku: "SYNTH-CASE-001" }],
    });
  });

  it("rejects oversized, unsupported and conflicting files before upload", async () => {
    const oversized = new File(
      [new Uint8Array(catalogueImportMaxBytes + 1)],
      "oversized.tsv",
      { type: "text/tab-separated-values" },
    );
    const unsupported = new File(["{}"], "catalogue.json", {
      type: "application/json",
    });
    const conflicting = new File(
      [catalogueImportTemplates.tsv],
      "catalogue.csv",
      { type: "text/tab-separated-values" },
    );

    await expect(validateCatalogueImportFile(oversized)).rejects.toThrow(
      /256 KiB.+256 KiB/iu,
    );
    await expect(validateCatalogueImportFile(unsupported)).rejects.toThrow(
      /CSV.+TSV.+CSV.+TSV/iu,
    );
    await expect(validateCatalogueImportFile(conflicting)).rejects.toThrow(
      /CSV.+TSV.+CSV.+TSV/iu,
    );
  });

  it("rejects invalid UTF-8 before parsing or upload", async () => {
    const file = new File([new Uint8Array([0xc3, 0x28])], "catalogue.csv", {
      type: "text/csv",
    });

    await expect(validateCatalogueImportFile(file)).rejects.toThrow(
      /UTF-8.+UTF-8/iu,
    );
  });
});
