import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

import { assetReviewQueueResponseSchema } from "../src/shared/domain/assets";
import type { RequestContext } from "../src/worker/auth/workspace";
import { assetReviewCursorHeader } from "../src/shared/lib/asset-review-pagination";
import { encodeAssetReviewCursor } from "../src/worker/lib/asset-review-cursor";
import { assetReviewQueueResponse } from "../src/worker/routes/assets";

const workspaceId = "workspace-review-queue-runtime";
const foreignWorkspaceId = "workspace-review-queue-foreign";

function context(): RequestContext {
  return {
    user: {
      id: "user-review-queue-runtime",
      email: "review-queue@example.invalid",
      displayName: "Synthetic Reviewer",
    },
    currentWorkspace: {
      id: workspaceId,
      slug: "review-queue-runtime",
      name: "Synthetic Review Queue",
      locale: "zh-Hant-HK",
      currency: "HKD",
      role: "owner",
    },
    workspaces: [],
  };
}

function queueRequest(cursor: string | null = null): Request {
  const headers = new Headers();
  if (cursor !== null) headers.set(assetReviewCursorHeader, cursor);
  return new Request("https://local.invalid/api/assets/review-queue", {
    headers,
  });
}

function timestamp(index: number): string {
  return new Date(Date.UTC(2026, 7, 30, 0, 0, index))
    .toISOString()
    .replace("T", " ")
    .replace(".000Z", "");
}

async function seedQueue(): Promise<void> {
  const statements: D1PreparedStatement[] = [
    env.DB.prepare(
      "INSERT INTO workspaces (id, slug, name) VALUES (?1, ?2, ?3)",
    ).bind(workspaceId, "review-queue-runtime", "Synthetic Review Queue"),
    env.DB.prepare(
      "INSERT INTO workspaces (id, slug, name) VALUES (?1, ?2, ?3)",
    ).bind(
      foreignWorkspaceId,
      "review-queue-foreign",
      "Synthetic Foreign Queue",
    ),
  ];

  for (let index = 0; index < 52; index += 1) {
    const suffix = String(index).padStart(3, "0");
    const partId = `part-review-queue-${suffix}`;
    statements.push(
      env.DB.prepare(
        `INSERT INTO catalog_parts (
           id, workspace_id, sku, category, manufacturer, model
         ) VALUES (?1, ?2, ?3, 'cooling', 'Synthetic Maker', ?4)`,
      ).bind(partId, workspaceId, `QUEUE-${suffix}`, `Queue Part ${suffix}`),
      env.DB.prepare(
        `INSERT INTO product_assets (
           id, workspace_id, catalog_part_id, status, quality, source_kind,
           updated_at
         ) VALUES (?1, ?2, ?3, 'draft', 'unreviewed', 'synthetic', ?4)`,
      ).bind(
        `asset-review-queue-${suffix}`,
        workspaceId,
        partId,
        timestamp(index),
      ),
    );
  }

  statements.push(
    env.DB.prepare(
      `INSERT INTO catalog_parts (
         id, workspace_id, sku, category, manufacturer, model
       ) VALUES (
         'part-review-queue-foreign', ?1, 'QUEUE-FOREIGN', 'cooling',
         'Synthetic Maker', 'Foreign Queue Part'
       )`,
    ).bind(foreignWorkspaceId),
    env.DB.prepare(
      `INSERT INTO product_assets (
         id, workspace_id, catalog_part_id, status, quality, source_kind,
         updated_at
       ) VALUES (
         'asset-review-queue-foreign', ?1, 'part-review-queue-foreign',
         'draft', 'unreviewed', 'synthetic', ?2
       )`,
    ).bind(foreignWorkspaceId, timestamp(1)),
  );

  await env.DB.batch(statements);
}

describe("asset review queue pagination", () => {
  it("keeps pages bounded, workspace-scoped and replayable after cursor mutation", async () => {
    await seedQueue();

    const firstResponse = await assetReviewQueueResponse(
      queueRequest(),
      env.DB,
      context(),
    );
    expect(firstResponse.headers.get("cache-control")).toBe(
      "private, no-store",
    );
    const first = assetReviewQueueResponseSchema.parse(
      await firstResponse.json(),
    );
    expect(first.items).toHaveLength(50);
    expect(first.items[0]?.id).toBe("asset-review-queue-000");
    expect(first.items.at(-1)?.id).toBe("asset-review-queue-049");
    expect(first.nextCursor).toBeTruthy();
    expect(first.nextCursor).not.toContain("asset-review-queue-049");
    expect(JSON.stringify(first.items)).not.toContain(foreignWorkspaceId);

    await env.DB.prepare(
      `UPDATE product_assets
       SET status = 'approved', quality = 'approved',
           updated_at = '2026-08-30 23:59:59'
       WHERE workspace_id = ?1 AND id = 'asset-review-queue-049'`,
    )
      .bind(workspaceId)
      .run();

    const loadNext = async () =>
      assetReviewQueueResponseSchema.parse(
        await (
          await assetReviewQueueResponse(
            queueRequest(first.nextCursor),
            env.DB,
            context(),
          )
        ).json(),
      );
    const second = await loadNext();
    const replay = await loadNext();

    expect(second.items.map((item) => item.id)).toEqual([
      "asset-review-queue-050",
      "asset-review-queue-051",
    ]);
    expect(second.nextCursor).toBeNull();
    expect(replay).toEqual(second);

    const foreignCursor = encodeAssetReviewCursor({
      assetId: "asset-review-queue-foreign",
      updatedAt: timestamp(1),
    });
    await expect(
      assetReviewQueueResponse(queueRequest(foreignCursor), env.DB, context()),
    ).rejects.toMatchObject({ status: 400, code: "VALIDATION_ERROR" });
  });
});
