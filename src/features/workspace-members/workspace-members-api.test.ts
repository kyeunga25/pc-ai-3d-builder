import { afterEach, describe, expect, it, vi } from "vitest";

import type { WorkspaceMember } from "../../shared/domain/workspace-members";
import {
  fetchWorkspaceMembers,
  inviteWorkspaceMember,
  updateWorkspaceMember,
} from "./workspace-members-api";

const member: WorkspaceMember = {
  id: "user_private_fixture",
  email: "member@example.invalid",
  displayName: "Synthetic Member",
  role: "staff",
  status: "active",
  identityState: "pending",
  isCurrentUser: false,
  version: 0,
  createdAt: "2026-08-30 00:00:00",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("workspace member API", () => {
  it("loads the protected directory without a workspace URL parameter", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ items: [member], hasMore: false }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchWorkspaceMembers(
        new AbortController().signal,
        "workspace_private_fixture",
      ),
    ).resolves.toMatchObject({ items: [member] });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(url).toBe("/api/workspace/members");
    expect(url).not.toContain("workspace_private_fixture");
    expect(headers.get("x-rigstage-workspace-id")).toBe(
      "workspace_private_fixture",
    );
    expect(headers.get("x-requested-with")).toBe("XMLHttpRequest");
  });

  it("keeps the private member ID out of update URLs and bodies", async () => {
    const updated = { ...member, role: "viewer" as const, version: 1 };
    const fetchMock = vi.fn().mockResolvedValue(Response.json(updated));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      updateWorkspaceMember("workspace_private_fixture", member.id, {
        expectedVersion: 0,
        role: "viewer",
        status: "active",
      }),
    ).resolves.toEqual(updated);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(url).toBe("/api/workspace/member");
    expect(url).not.toContain(member.id);
    expect(String(init.body)).not.toContain(member.id);
    expect(headers.get("x-rigstage-workspace-member-id")).toBe(member.id);
  });

  it("sends a bounded invitation only to the fixed protected endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(member));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      inviteWorkspaceMember("workspace_private_fixture", {
        email: member.email,
        displayName: member.displayName,
        role: member.role,
      }),
    ).resolves.toEqual(member);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/workspace/members");
    expect(url).not.toContain(member.email);
    expect(String(init.body)).toContain(member.email);
    expect(new Headers(init.headers).get("content-type")).toBe(
      "application/json",
    );
  });
});
