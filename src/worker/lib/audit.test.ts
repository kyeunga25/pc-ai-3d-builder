import { describe, expect, it } from "vitest";

import { appendAuditEvent } from "./audit";

describe("audit event helper", () => {
  it("uses a prepared statement and stores only supplied structured metadata", async () => {
    let captured: unknown[] = [];
    const db = {
      prepare() {
        return {
          bind(...values: unknown[]) {
            captured = values;
            return {
              async run() {
                return { success: true };
              },
            };
          },
        };
      },
    } as unknown as D1Database;

    await appendAuditEvent(db, {
      workspaceId: "ws_pilot",
      userId: "user_pilot",
      action: "session.resolved",
      targetType: "workspace",
      targetId: "ws_pilot",
      requestId: "req_test",
      metadata: { role: "owner" },
    });

    expect(captured.slice(1)).toEqual([
      "ws_pilot",
      "user_pilot",
      "session.resolved",
      "workspace",
      "ws_pilot",
      "req_test",
      '{"role":"owner"}',
    ]);
  });
});
