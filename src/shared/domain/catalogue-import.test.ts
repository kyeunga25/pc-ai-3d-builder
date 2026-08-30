import { describe, expect, it } from "vitest";

import {
  catalogueImportFormatForFile,
  catalogueImportTemplates,
  parseCatalogueImportFile,
} from "./catalogue-import";

describe("catalogue tabular import", () => {
  it("parses the synthetic CSV and TSV templates into the same product", () => {
    const csv = parseCatalogueImportFile(catalogueImportTemplates.csv, "csv");
    const tsv = parseCatalogueImportFile(catalogueImportTemplates.tsv, "tsv");

    expect(csv).toEqual(tsv);
    expect(tsv).toEqual([
      expect.objectContaining({
        sku: "SYNTH-CASE-001",
        category: "case",
        manufacturer: "示範品牌",
        model: "示範機箱",
        priceMinor: 84_900,
        specifications: {
          formFactor: "ATX",
          maxGpuLengthMm: 392,
        },
      }),
    ]);
  });

  it("accepts registered media types or known extensions and rejects conflicts", () => {
    expect(catalogueImportFormatForFile("catalogue.csv", "text/csv")).toBe(
      "csv",
    );
    expect(
      catalogueImportFormatForFile(
        "catalogue.tsv",
        "text/tab-separated-values",
      ),
    ).toBe("tsv");
    expect(catalogueImportFormatForFile("CATALOGUE.TSV", "")).toBe("tsv");
    expect(
      catalogueImportFormatForFile("catalogue.csv", "application/octet-stream"),
    ).toBe("csv");
    expect(
      catalogueImportFormatForFile(
        "catalogue.csv",
        "text/tab-separated-values",
      ),
    ).toBeNull();
    expect(
      catalogueImportFormatForFile("catalogue.json", "application/json"),
    ).toBeNull();
  });

  it("keeps delimiters inside correctly quoted fields", () => {
    const tsv = catalogueImportTemplates.tsv.replace(
      '{"formFactor":"ATX","maxGpuLengthMm":392}',
      '"{""formFactor"":\t""ATX"",""maxGpuLengthMm"":392}"',
    );

    expect(parseCatalogueImportFile(tsv, "tsv")[0]?.specifications).toEqual({
      formFactor: "ATX",
      maxGpuLengthMm: 392,
    });
  });
});
