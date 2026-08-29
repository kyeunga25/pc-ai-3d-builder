import { describe, expect, it } from "vitest";

import {
  workspaceMemberIdentityCopy,
  workspaceMemberInterfaceCopy,
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
});
