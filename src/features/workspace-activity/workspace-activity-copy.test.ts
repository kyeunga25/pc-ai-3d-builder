import { describe, expect, it } from "vitest";

import { workspaceActivityActions } from "../../shared/domain/workspace-activity";
import {
  workspaceActivityActionCopy,
  workspaceActivityFailureNotice,
  workspaceActivityTimeCopy,
} from "./workspace-activity-copy";

describe("workspace activity copy", () => {
  it("covers every public activity action in both languages", () => {
    expect(Object.keys(workspaceActivityActionCopy).sort()).toEqual(
      [...workspaceActivityActions].sort(),
    );
    for (const value of Object.values(workspaceActivityActionCopy)) {
      expect(value.zhHant.length).toBeGreaterThan(0);
      expect(value.english.length).toBeGreaterThan(0);
    }
  });

  it("formats valid D1 timestamps and safely labels invalid input", () => {
    const valid = workspaceActivityTimeCopy("2026-08-30 00:00:00");
    expect(valid.zhHant).toContain("2026");
    expect(valid.english).toContain("2026");

    expect(workspaceActivityTimeCopy("not-a-time")).toEqual({
      zhHant: "時間資料無效",
      english: "Invalid timestamp",
    });
  });

  it("preserves a bounded bilingual API failure without raw fallback text", () => {
    expect(
      workspaceActivityFailureNotice(
        new Error(
          "活動記錄暫時不可用。 / Activity is temporarily unavailable.",
        ),
      ),
    ).toEqual({
      tone: "error",
      copy: {
        zhHant: "活動記錄暫時不可用。",
        english: "Activity is temporarily unavailable.",
      },
    });
  });
});
