import { describe, expect, it } from "vitest";

import { ApiError } from "../lib/api-error";
import {
  chooseCurrentWorkspace,
  persistWorkspaceSelection,
  resolveRequestContext,
  type WorkspaceMembershipRow,
} from "./workspace";

const memberships: WorkspaceMembershipRow[] = [
  {
    id: "ws_alpha",
    slug: "alpha",
    name: "Alpha",
    locale: "zh-Hant-HK",
    currency: "HKD",
    role: "owner",
  },
  {
    id: "ws_beta",
    slug: "beta",
    name: "Beta",
    locale: "zh-Hant-HK",
    currency: "HKD",
    role: "staff",
  },
];

type FakeUser = {
  id: string;
  email: string;
  access_subject: string | null;
  display_name: string | null;
  last_workspace_id: string | null;
};

function fakeDatabase(
  user: FakeUser | null,
  rows = memberships,
  options: {
    bindingChanges?: number;
    boundSubjectAfterRace?: string | null;
  } = {},
) {
  const writes: Array<{ sql: string; values: unknown[] }> = [];
  const queries: string[] = [];
  const db = {
    prepare(sql: string) {
      queries.push(sql);
      return {
        bind(...values: unknown[]) {
          return {
            async first() {
              if (sql.includes("AS has_active_membership")) {
                return {
                  access_subject: options.boundSubjectAfterRace ?? null,
                  has_active_membership: 1,
                };
              }
              return user;
            },
            async all() {
              return { success: true, results: rows };
            },
            async run() {
              writes.push({ sql, values });
              return {
                success: true,
                meta: { changes: options.bindingChanges ?? 1 },
              };
            },
          };
        },
      };
    },
  } as unknown as D1Database;

  return { db, queries, writes };
}

describe("workspace scope resolution", () => {
  it("uses only a requested workspace present in the active memberships", () => {
    expect(chooseCurrentWorkspace(memberships, "ws_beta", "ws_alpha").id).toBe(
      "ws_beta",
    );
  });

  it("rejects workspace ID tampering", () => {
    expect(() =>
      chooseCurrentWorkspace(memberships, "ws_not_a_member", "ws_alpha"),
    ).toThrowError(
      expect.objectContaining<Partial<ApiError>>({
        status: 403,
        code: "WORKSPACE_FORBIDDEN",
      }),
    );
  });

  it("rejects an invited identity with no active membership", () => {
    expect(() => chooseCurrentWorkspace([], null, null)).toThrowError(
      expect.objectContaining<Partial<ApiError>>({
        status: 403,
        code: "INVITE_REQUIRED",
      }),
    );
  });

  it("does not auto-provision a verified but uninvited identity", async () => {
    const { db, writes } = fakeDatabase(null);

    await expect(
      resolveRequestContext(
        db,
        {
          subject: "access-uninvited",
          email: "uninvited@example.com",
          displayName: null,
        },
        null,
      ),
    ).rejects.toMatchObject({ status: 403, code: "INVITE_REQUIRED" });
    expect(writes).toHaveLength(0);
  });

  it("filters suspended accounts before membership resolution", async () => {
    const { db, queries, writes } = fakeDatabase(null);

    await expect(
      resolveRequestContext(
        db,
        {
          subject: "access-suspended",
          email: "suspended@example.com",
          displayName: null,
        },
        null,
      ),
    ).rejects.toMatchObject({ status: 403, code: "INVITE_REQUIRED" });

    expect(queries[0]).toContain("WHERE status = 'active'");
    expect(queries).toHaveLength(1);
    expect(writes).toHaveLength(0);
  });

  it("binds an invited identity only after resolving an active membership", async () => {
    const { db, queries, writes } = fakeDatabase({
      id: "user_pilot",
      email: "pilot@example.com",
      access_subject: null,
      display_name: "試行用戶",
      last_workspace_id: null,
    });

    const context = await resolveRequestContext(
      db,
      {
        subject: "access-pilot",
        email: "pilot@example.com",
        displayName: null,
      },
      "ws_beta",
    );

    expect(context.currentWorkspace.id).toBe("ws_beta");
    expect(context.workspaces).toHaveLength(2);
    expect(queries[1]).toContain("wm.status = 'active'");
    expect(queries[1]).toContain("w.status = 'active'");
    expect(writes).toHaveLength(1);
    expect(writes[0]?.values).toEqual([
      "access-pilot",
      "ws_beta",
      "user_pilot",
    ]);
  });

  it("rejects a losing concurrent subject binding", async () => {
    const { db } = fakeDatabase(
      {
        id: "user_pilot",
        email: "pilot@example.com",
        access_subject: null,
        display_name: "試行用戶",
        last_workspace_id: null,
      },
      memberships,
      {
        bindingChanges: 0,
        boundSubjectAfterRace: "access-winner",
      },
    );

    await expect(
      resolveRequestContext(
        db,
        {
          subject: "access-loser",
          email: "pilot@example.com",
          displayName: null,
        },
        null,
      ),
    ).rejects.toMatchObject({
      status: 403,
      code: "IDENTITY_BINDING_CONFLICT",
    });
  });

  it("allows a repeated concurrent binding by the same subject", async () => {
    const { db } = fakeDatabase(
      {
        id: "user_pilot",
        email: "pilot@example.com",
        access_subject: null,
        display_name: "試行用戶",
        last_workspace_id: null,
      },
      memberships,
      {
        bindingChanges: 0,
        boundSubjectAfterRace: "access-pilot",
      },
    );

    await expect(
      resolveRequestContext(
        db,
        {
          subject: "access-pilot",
          email: "pilot@example.com",
          displayName: null,
        },
        null,
      ),
    ).resolves.toMatchObject({
      user: { id: "user_pilot" },
    });
  });

  it("resolves a requested workspace without persisting from the read path", async () => {
    const { db, writes } = fakeDatabase({
      id: "user_pilot",
      email: "pilot@example.com",
      access_subject: "access-pilot",
      display_name: "試行用戶",
      last_workspace_id: "ws_alpha",
    });

    await expect(
      resolveRequestContext(
        db,
        {
          subject: "access-pilot",
          email: "pilot@example.com",
          displayName: null,
        },
        "ws_beta",
      ),
    ).resolves.toMatchObject({
      currentWorkspace: { id: "ws_beta", role: "staff" },
    });
    expect(writes).toHaveLength(0);
  });

  it("rejects a non-member workspace without a preference write", async () => {
    const { db, writes } = fakeDatabase({
      id: "user_pilot",
      email: "pilot@example.com",
      access_subject: "access-pilot",
      display_name: "試行用戶",
      last_workspace_id: "ws_alpha",
    });

    await expect(
      resolveRequestContext(
        db,
        {
          subject: "access-pilot",
          email: "pilot@example.com",
          displayName: null,
        },
        "ws_not_a_member",
      ),
    ).rejects.toMatchObject({ status: 403, code: "WORKSPACE_FORBIDDEN" });
    expect(writes).toHaveLength(0);
  });

  it("persists an explicit workspace selection with the bound identity", async () => {
    const { db, writes } = fakeDatabase({
      id: "user_pilot",
      email: "pilot@example.com",
      access_subject: "access-pilot",
      display_name: "試行用戶",
      last_workspace_id: "ws_alpha",
    });
    const context = await resolveRequestContext(
      db,
      {
        subject: "access-pilot",
        email: "pilot@example.com",
        displayName: null,
      },
      "ws_beta",
    );

    await expect(
      persistWorkspaceSelection(db, context, "access-pilot"),
    ).resolves.toBeUndefined();
    expect(writes).toHaveLength(1);
    expect(writes[0]?.values).toEqual([
      "ws_beta",
      "user_pilot",
      "access-pilot",
    ]);
  });

  it("fails closed when an explicit workspace selection loses its guard", async () => {
    const { db } = fakeDatabase(
      {
        id: "user_pilot",
        email: "pilot@example.com",
        access_subject: "access-pilot",
        display_name: "試行用戶",
        last_workspace_id: "ws_alpha",
      },
      memberships,
      { bindingChanges: 0 },
    );
    const context = await resolveRequestContext(
      db,
      {
        subject: "access-pilot",
        email: "pilot@example.com",
        displayName: null,
      },
      "ws_beta",
    );

    await expect(
      persistWorkspaceSelection(db, context, "access-pilot"),
    ).rejects.toMatchObject({ status: 403, code: "WORKSPACE_FORBIDDEN" });
  });
});
