import { describe, expect, it } from "vitest";

import {
  catalogueArchivedStatus,
  catalogueCountStatus,
  catalogueCreatedStatus,
  catalogueFailureStatus,
  catalogueImportedStatus,
  catalogueStatusCopy,
  catalogueUpdatedStatus,
} from "./catalogue-status";

const bilingualStatusPattern = /[\u3400-\u9fff].+ \/ .*[A-Za-z]/u;

describe("Catalogue operation status copy", () => {
  it("keeps every static operation state in Traditional Chinese and English", () => {
    for (const status of Object.values(catalogueStatusCopy)) {
      expect(status.message).toMatch(bilingualStatusPattern);
      expect(["error", "info", "success", "warning"]).toContain(status.tone);
    }
  });

  it("keeps count and mutation outcomes bilingual", () => {
    expect(catalogueCountStatus(12, true).message).toContain(
      "12 件產品 / 12 products",
    );
    expect(catalogueCountStatus(8, false).message).toContain(
      "8 件工作空間產品 / 8 workspace products",
    );
    expect(catalogueCreatedStatus("TEST-001").message).toContain(
      "已新增 TEST-001 / Added TEST-001",
    );
    expect(catalogueUpdatedStatus("TEST-002").message).toContain(
      "已更新 TEST-002 / Updated TEST-002",
    );
    expect(catalogueArchivedStatus("TEST-003").message).toContain(
      "已封存 TEST-003 / Archived TEST-003",
    );
    expect(catalogueImportedStatus(4).message).toContain(
      "已匯入 4 件產品 / Imported 4 products",
    );
  });

  it.each(["archive", "asset-draft", "import", "save"] as const)(
    "replaces a monolingual %s failure with a safe bilingual fallback",
    (operation) => {
      const status = catalogueFailureStatus(
        new TypeError("Failed to fetch"),
        operation,
      );

      expect(status.message).toMatch(bilingualStatusPattern);
      expect(status.message).not.toContain("Failed to fetch");
      expect(status.message).toContain("重新載入");
      expect(status.message).toContain("reload");
      expect(status.tone).toBe("error");
    },
  );

  it("does not falsely claim an uncertain write made no server-side change", () => {
    for (const operation of [
      "archive",
      "asset-draft",
      "import",
      "save",
    ] as const) {
      const status = catalogueFailureStatus(
        new Error("Network error"),
        operation,
      );

      expect(status.message).toContain("無法確認");
      expect(status.message).toContain("Unable to confirm");
      expect(status.message).not.toContain("no data was changed");
    }
  });

  it("retains a valid bilingual public error and rejects malformed copy", () => {
    const publicMessage =
      "產品版本已改變，請重新載入。 / The product version changed. Reload before retrying.";

    expect(catalogueFailureStatus(new Error(publicMessage), "save")).toEqual({
      message: publicMessage,
      tone: "error",
    });
    expect(catalogueFailureStatus(new Error("錯誤。 / "), "archive")).toEqual(
      catalogueStatusCopy.archiveFailed,
    );
  });
});
