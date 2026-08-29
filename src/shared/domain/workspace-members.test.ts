import { describe, expect, it } from "vitest";

import {
  assignableWorkspaceMemberRoles,
  workspaceMemberInviteSchema,
  workspaceMemberListResponseSchema,
  workspaceMemberUpdateSchema,
} from "./workspace-members";

describe("workspace member contracts", () => {
  it("normalizes a bounded invitation without weakening the requested role", () => {
    expect(
      workspaceMemberInviteSchema.parse({
        displayName: "  Synthetic Operator  ",
        email: "  OPERATOR@EXAMPLE.INVALID  ",
        role: "staff",
      }),
    ).toEqual({
      displayName: "Synthetic Operator",
      email: "operator@example.invalid",
      role: "staff",
    });
  });

  it("rejects malformed member input and invalid optimistic versions", () => {
    expect(
      workspaceMemberInviteSchema.safeParse({
        displayName: "Unsafe\u0000Name",
        email: "not-an-email",
        role: "owner",
      }).success,
    ).toBe(false);
    expect(
      workspaceMemberInviteSchema.safeParse({
        displayName: "Unsafe\u0085Name",
        email: "operator@example.invalid",
        role: "staff",
      }).success,
    ).toBe(false);
    expect(
      workspaceMemberUpdateSchema.safeParse({
        expectedVersion: -1,
        role: "viewer",
        status: "active",
      }).success,
    ).toBe(false);
  });

  it("keeps assignment authority narrower for administrators", () => {
    expect(assignableWorkspaceMemberRoles("owner")).toEqual([
      "owner",
      "admin",
      "staff",
      "viewer",
    ]);
    expect(assignableWorkspaceMemberRoles("admin")).toEqual([
      "staff",
      "viewer",
    ]);
    expect(assignableWorkspaceMemberRoles("staff")).toEqual([]);
    expect(assignableWorkspaceMemberRoles("viewer")).toEqual([]);
  });

  it("accepts only bounded protected member projections", () => {
    expect(
      workspaceMemberListResponseSchema.parse({
        hasMore: false,
        items: [
          {
            createdAt: "2026-08-30 00:00:00",
            displayName: "Synthetic Owner",
            email: "owner@example.invalid",
            id: "user_synthetic_owner",
            identityState: "bound",
            isCurrentUser: true,
            role: "owner",
            status: "active",
            version: 2,
          },
        ],
      }).items[0],
    ).toMatchObject({
      identityState: "bound",
      isCurrentUser: true,
      version: 2,
    });
  });
});
