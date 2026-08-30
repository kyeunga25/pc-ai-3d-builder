import { describe, expect, it } from "vitest";

import {
  workspaceMemberIdentityCopy,
  workspaceMemberInterfaceCopy,
  workspaceMemberLoadedCount,
  workspaceMemberNoticeCopy,
  workspaceMemberRoleCopy,
  workspaceMemberStatusCopy,
} from "./workspace-members-copy";

describe("workspace member bilingual copy", () => {
  it("covers every role, status and identity state in both languages", () => {
    expect(Object.keys(workspaceMemberRoleCopy)).toEqual([
      "owner",
      "admin",
      "staff",
      "viewer",
    ]);
    expect(Object.keys(workspaceMemberStatusCopy)).toEqual([
      "active",
      "suspended",
    ]);
    expect(Object.keys(workspaceMemberIdentityCopy)).toEqual([
      "pending",
      "bound",
      "blocked",
    ]);
    for (const value of [
      ...Object.values(workspaceMemberInterfaceCopy),
      ...Object.values(workspaceMemberRoleCopy),
      ...Object.values(workspaceMemberStatusCopy),
      ...Object.values(workspaceMemberIdentityCopy),
      ...Object.values(workspaceMemberNoticeCopy).map((notice) => notice.copy),
    ]) {
      expect(value.zhHant.length).toBeGreaterThan(0);
      expect(value.english.length).toBeGreaterThan(0);
    }
  });

  it("reports loaded directory counts with correct English grammar", () => {
    expect(workspaceMemberLoadedCount(1)).toEqual({
      zhHant: "已載入 1 位成員",
      english: "1 member loaded",
    });
    expect(workspaceMemberLoadedCount(3)).toEqual({
      zhHant: "已載入 3 位成員",
      english: "3 members loaded",
    });
  });
});
