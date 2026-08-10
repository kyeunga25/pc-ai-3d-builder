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

Private owner onboarding activates one existing non-archived owner workspace or creates one generic owner workspace. It never seeds an identity or workspace in a migration. If the optional generation credit schema exists, onboarding may create a bounded non-monetary account without overwriting an existing ledger.

## `audit_events`

Reserved for meaningful state transitions. Read-only session resolution does not create audit rows. Metadata must be small, structured and free of JWTs, email addresses, provider keys, prompts and private object URLs.

## `catalog_parts`

Stores workspace-scoped product identity, pricing, stock state and structured-specification verification status. SKU uniqueness is enforced within a workspace. A non-negative record version protects concurrent edits, while `status` supports logical archive without deleting records. No production catalogue rows are included in migrations.

## `product_assets`

Stores one current visual-asset review record per workspace catalogue part. The review version supports optimistic concurrency. Source-rights confirmation, completed checklist identifiers and human-verified dimensions are stored independently from private source-image and GLB metadata.

Private file columns store opaque R2 object keys, validated content types, bounded byte sizes and SHA-256 checksums. Asset approval rechecks model existence, byte size and content type through R2 metadata before committing a review transition. Private file metadata never appears in browser API records, audit metadata, logs or checked-in fixtures.

## `asset_review_events`

Append-only review history for draft saves, approvals and rejections. Each asset version may appear once. The matching asset update, review event and minimal audit event are executed in one D1 batch.

## `builds`

Stores workspace-scoped draft identity, logical status, optimistic record version and a server-only mutation token. The token gates every selection statement in an update batch and is never returned by the API or written to audit metadata.

## `build_items`

Stores at most one selected catalogue part per build and component category. Composite foreign keys require the build, catalogue part and recorded category to belong to the same workspace. A referenced catalogue part keeps its category until every build reference is removed; other catalogue fields remain editable through optimistic version checks. Archived catalogue parts remain referentially intact for existing builds, while an insertion trigger rejects new selections if a part becomes inactive after application validation.

## `generation_jobs`

Stores one durable, workspace-scoped orchestration record per explicit request. The record includes the asset, requester, unique idempotency key, unique Workflow instance ID, requested review version, input checksum, execution mode, zero monetary cap, provider cost-unit cap, state, stable failure/validation codes and private output metadata.

The browser representation omits the input checksum, Workflow ID, object keys, output checksum, requester and private attempt identifiers. It may return bounded provider-neutral cost units, entitlement state and a stable validation code; these values contain no price or provider identity. A partial unique index permits at most one queued, running or validating job for a workspace asset, while the request guard also blocks a new job when an `awaiting_review` job still owns a reserved entitlement. The currently valid execution mode is `simulation`; no external-provider identifier appears in the table or public domain model.

## `generation_job_events`

Stores append-only queued, running, validating, review-ready, failed or cancelled transitions. Metadata is bounded and may record safe geometry counts, dimensions, sizes, review versions, stable validation codes and integer cost-unit results only. It must not contain user identity, source or output object keys, checksums, prompts, provider responses or raw errors.

## `generation_credit_accounts`

Stores workspace-scoped non-monetary generation entitlement totals: available, reserved, settled and released units. Migration `0009` creates no account rows and grants no credit; provisioning remains an explicit administrative/product decision outside this milestone. Every value is non-negative. This table is not a wallet, invoice, payment balance or provider bill.

## `generation_job_entitlements`

Links exactly one bounded credit reservation to a generation job. Its terminal state is `settled` after asset approval or `released` after rejection, failure, start failure or draft replacement. Guarded D1 batches allow only a `reserved` row to transition, so retries cannot settle or release the same unit twice.

## `generation_credit_events`

Stores append-only `reserve`, `settle` and `release` events with one event of each type per job. It records integer units and stable reason codes only. It contains no money, customer identity, provider reference or deployment coordinate.

## `generation_provider_attempts`

Stores one internal attempt row per `(workspace, job, attempt_key)`. A row moves from `started` to one immutable terminal result, with bounded cost units, duration and stable validation code. Matching terminal repeats are idempotent; conflicting, late or different-key results are rejected. Raw provider payloads, prompts, credentials, source bytes and provider-specific IDs are not stored.

## Migration rules

- Add schema changes through numbered migration files.
- Keep foreign keys and uniqueness constraints explicit.
- Use bound parameters for request-influenced values.
- Do not add production records, account identifiers or resource names to migrations.
- Test migrations against an empty temporary database and run `PRAGMA foreign_key_check`.
- Keep every catalogue, asset, review and build relation explicitly workspace-scoped.
- Submit a catalogue row and its minimal audit event in one D1 batch; CSV imports are all-or-nothing and contain at most 50 rows.
- Do not place object keys or checksums in audit events. Replacing a file must increment the review version and reset prior approval evidence.
- Build selection updates must use an expected version and server-only mutation token in one D1 batch.
- Generation requests must reserve an available entitlement and persist the job, entitlement, credit event, initial job event and minimal audit record before triggering a Workflow. Idempotency is unique within the workspace.
- Generated output may update an asset only while its source checksum, saved rights confirmation and review version still match the requested input.
- Staging a generated draft must update the asset review version, job state, job event and minimal audit record in one guarded batch; output remains private and unapproved.
- Approval must settle a reserved entitlement; rejection, terminal failure, start failure or generated-draft replacement must release it. Retried terminal transitions must make no additional account or event change.
- Provider attempt results must use the same attempt key, match an active job and transition only from `started`. Do not persist raw provider errors or payloads.
