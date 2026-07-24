# Data model

The public branch documents only tables created by the checked-in migrations.

## `rigstage_metadata`

Stores non-sensitive schema/bootstrap metadata.

## `workspaces`

Represents an isolated merchant workspace. Protected queries must derive the workspace from active membership rather than trust a client-supplied identifier.

## `users`

Stores invited application users. The verified Cloudflare Access subject is initially null and is bound with a conditional update after active membership has been resolved. A zero-row update must be re-read and accepted only when the persisted subject equals the requester.

## `workspace_memberships`

Links users to workspaces with an explicit role and status. Server routes select only active memberships and active workspaces.

## `audit_events`

Reserved for meaningful state transitions. Read-only session resolution does not create audit rows. Metadata must be small, structured and free of JWTs, email addresses, provider keys, prompts and private object URLs.

## Migration rules

- Add schema changes through numbered migration files.
- Keep foreign keys and uniqueness constraints explicit.
- Use bound parameters for request-influenced values.
- Do not add production records, account identifiers or resource names to migrations.
- Test migrations against an empty temporary database and run `PRAGMA foreign_key_check`.
