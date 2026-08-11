import { describe, expect, it } from "vitest";

import {
  builderArchivedStatus,
  builderFailureStatus,
  builderLoadedStatus,
  builderSavedStatus,
  builderStatusCopy,
} from "./builder-status";

const bilingualStatusPattern = /[\u3400-\u9fff].+ \/ .*[A-Za-z]/u;

describe("Builder operation status copy", () => {
  it("keeps every static operation state in Traditional Chinese and English", () => {
    for (const status of Object.values(builderStatusCopy)) {
      expect(status.message).toMatch(bilingualStatusPattern);
      expect(["error", "info", "success", "warning"]).toContain(status.tone);
    }
  });

  it("keeps versioned load, save and archive outcomes bilingual", () => {
    expect(builderLoadedStatus(7)).toEqual({
      message: "已載入版本 7。 / Version 7 is loaded.",
      tone: "success",
    });
    expect(builderSavedStatus(8, true)).toEqual({
      message: "本地版本 8 已儲存。 / Local version 8 is saved.",
      tone: "success",
    });
    expect(builderSavedStatus(8, false)).toEqual({
      message: "D1 版本 8 已儲存。 / D1 version 8 is saved.",
      tone: "success",
    });
    expect(builderArchivedStatus(9)).toEqual({
      message:
        "已封存上一個組裝；已載入版本 9。 / The previous build was archived; version 9 is loaded.",
      tone: "success",
    });
    expect(builderArchivedStatus(null)).toEqual({
      message:
        "組裝已封存；目前沒有其他草稿。 / The build was archived; there are no other drafts.",
      tone: "success",
    });
  });

  it.each([
    ["create", builderStatusCopy.createFailed],
    ["switch", builderStatusCopy.switchFailed],
    ["save", builderStatusCopy.saveFailed],
    ["archive", builderStatusCopy.archiveFailed],
    ["export", builderStatusCopy.exportFailed],
  ] as const)(
    "replaces a monolingual %s error with an operation-safe bilingual fallback",
    (operation, expected) => {
      const message = builderFailureStatus(
        new TypeError("Failed to fetch"),
        operation,
      );

      expect(message).toEqual(expected);
      expect(message.tone).toBe("error");
      expect(message.message).not.toContain("Failed to fetch");
    },
  );

  it("retains a valid bilingual public error without exposing malformed copy", () => {
    expect(
      builderFailureStatus(
        new Error(
          "組裝版本已改變，請重新載入。 / The build version changed. Reload before retrying.",
        ),
        "save",
      ),
    ).toEqual({
      message:
        "組裝版本已改變，請重新載入。 / The build version changed. Reload before retrying.",
      tone: "error",
    });
    expect(builderFailureStatus(new Error("錯誤。 / "), "archive")).toEqual(
      builderStatusCopy.archiveFailed,
    );
  });
});
