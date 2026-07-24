export type AuditEventInput = {
  workspaceId: string;
  userId: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  requestId: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export async function appendAuditEvent(
  db: D1Database,
  event: AuditEventInput,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO audit_events (
         id, workspace_id, user_id, action, target_type, target_id,
         request_id, metadata_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      event.workspaceId,
      event.userId,
      event.action,
      event.targetType ?? null,
      event.targetId ?? null,
      event.requestId,
      JSON.stringify(event.metadata ?? {}),
    )
    .run();
}
