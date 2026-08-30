import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import type { WorkspaceRole } from "../src/shared/domain/session";
import { workspaceActivityResponseSchema } from "../src/shared/domain/workspace-activity";
import { workspaceActivityCursorHeader } from "../src/shared/lib/workspace-activity-pagination";
import type { RequestContext } from "../src/worker/auth/workspace";
import { workspaceActivityResponse } from "../src/worker/routes/workspace-activity";

type ActorFixture = {
  email: string;
  role: WorkspaceRole;
  slug: string;
  userId: string;
  workspaceId: string;
};

function actor(label: string, role: WorkspaceRole = "owner"): ActorFixture {
  return {
    email: `${label}@example.invalid`,
    role,
    slug: label,
    userId: `user-${label}`,
    workspaceId: `workspace-${label}`,
  };
}

function context(value: ActorFixture): RequestContext {
  return {
    user: {
      id: value.userId,
      email: value.email,
      displayName: "Synthetic Manager",
    },
    currentWorkspace: {
      id: value.workspaceId,
      slug: value.slug,
      name: "Synthetic Workspace",
      locale: "zh-Hant-HK",
      currency: "HKD",
      role: value.role,
    },
    workspaces: [],
  };
}

async function seedActor(value: ActorFixture): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO workspaces (id, slug, name) VALUES (?1, ?2, ?3)",
    ).bind(value.workspaceId, value.slug, "Synthetic Workspace"),
    env.DB.prepare(
      `INSERT INTO users (
         id, email, access_subject, display_name, status, last_workspace_id
       ) VALUES (?1, ?2, ?3, ?4, 'active', ?5)`,
    ).bind(
      value.userId,
      value.email,
      `access-${value.slug}`,
      "Synthetic Manager",
      value.workspaceId,
    ),
    env.DB.prepare(
      `INSERT INTO workspace_memberships (workspace_id, user_id, role)
       VALUES (?1, ?2, ?3)`,
    ).bind(value.workspaceId, value.userId, value.role),
  ]);
}

function request(cursor: string | null = null, query = ""): Request {
  const headers = new Headers();
  if (cursor !== null) headers.set(workspaceActivityCursorHeader, cursor);
  return new Request(`https://local.invalid/api/workspace/activity${query}`, {
    headers,
  });
}

async function seedActivity(owner: ActorFixture, count: number): Promise<void> {
  const actions = [
    "workspace.member.invite",
    "catalogue.part.update",
    "asset.review.approve",
    "build.create",
    "generation.request",
  ] as const;
  const statements = Array.from({ length: count }, (_, index) => {
    const createdAt = new Date(Date.UTC(2026, 7, 30, 0, 0, index))
      .toISOString()
      .replace("T", " ")
      .replace(".000Z", "");
    const action =
      index === count - 1
        ? "private.provider.coordinate.changed"
        : actions[index % actions.length];
    return env.DB.prepare(
      `INSERT INTO audit_events (
         id, workspace_id, user_id, action, target_type, target_id,
         request_id, metadata_json, created_at
       ) VALUES (?1, ?2, ?3, ?4, 'private_target', ?5, ?6, ?7, ?8)`,
    ).bind(
      `event-${owner.slug}-${String(index).padStart(3, "0")}`,
      owner.workspaceId,
      index === count - 2 ? null : owner.userId,
      action,
      `target-private-${index}`,
      `request-private-${index}`,
      JSON.stringify({
        email: `private-${index}@example.invalid`,
        objectKey: `private/object/${index}`,
      }),
      createdAt,
    );
  });
  await env.DB.batch(statements);
}

describe("workspace activity log", () => {
  it("returns bounded manager-only pages without raw audit details", async () => {
    const owner = actor("activity-owner");
    const foreignOwner = actor("activity-foreign");
    await seedActor(owner);
    await seedActor(foreignOwner);
    await seedActivity(owner, 52);
    await seedActivity(foreignOwner, 1);

    const firstResponse = await workspaceActivityResponse(
      request(),
      env.DB,
      context(owner),
    );
    expect(firstResponse.status).toBe(200);
    expect(firstResponse.headers.get("cache-control")).toBe(
      "private, no-store",
    );
    const first = workspaceActivityResponseSchema.parse(
      await firstResponse.json(),
    );
    expect(first.items).toHaveLength(50);
    expect(first.nextCursor).toBeTruthy();
    expect(first.items[0]).toMatchObject({
      action: "other",
      category: "other",
      actorDisplayName: "Synthetic Manager",
    });
    expect(first.items[1]?.actorDisplayName).toBeNull();
    expect(Object.keys(first.items[0] ?? {}).sort()).toEqual([
      "action",
      "actorDisplayName",
      "category",
      "createdAt",
    ]);

    const firstJson = JSON.stringify(first.items);
    expect(firstJson).not.toContain("request-private");
    expect(firstJson).not.toContain("target-private");
    expect(firstJson).not.toContain("private/object");
    expect(firstJson).not.toContain("@example.invalid");
    expect(firstJson).not.toContain(foreignOwner.slug);

    const secondResponse = await workspaceActivityResponse(
      request(first.nextCursor),
      env.DB,
      context(owner),
    );
    const second = workspaceActivityResponseSchema.parse(
      await secondResponse.json(),
    );
    expect(second.items).toHaveLength(2);
    expect(second.nextCursor).toBeNull();
  });

  it("rejects staff, URL cursors, malformed headers and foreign cursors", async () => {
    const owner = actor("activity-boundary-owner");
    const staff = actor("activity-boundary-staff", "staff");
    const foreignOwner = actor("activity-boundary-foreign");
    await seedActor(owner);
    await seedActor(staff);
    await seedActor(foreignOwner);
    await seedActivity(owner, 1);
    await seedActivity(foreignOwner, 1);

    await expect(
      workspaceActivityResponse(request(), env.DB, context(staff)),
    ).rejects.toMatchObject({ code: "ROLE_FORBIDDEN", status: 403 });
    await expect(
      workspaceActivityResponse(
        request(null, "?cursor=event-private"),
        env.DB,
        context(owner),
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
    await expect(
      workspaceActivityResponse(
        request("invalid/cursor"),
        env.DB,
        context(owner),
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
    await expect(
      workspaceActivityResponse(
        request(`event-${foreignOwner.slug}-000`),
        env.DB,
        context(owner),
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
  });
});
