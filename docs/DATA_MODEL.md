# Data model

The public branch documents only tables created by the checked-in migrations.

## `rigstage_metadata`

Stores non-sensitive schema/bootstrap metadata.

## `workspaces`

Represents an isolated merchant workspace. Protected queries must derive the workspace from active membership rather than trust a client-supplied identifier.

## `users`

Stores invited application users. A new-email workspace invitation creates an `invited` user with no Access subject; an existing active user may receive another workspace membership without rewriting identity data. Neither path changes the deployment's Cloudflare Access policy. On the first verified login, the subject-binding conditional update also moves a new invited user to `active` only while the selected workspace and membership remain active. A zero-row result is accepted only when the persisted subject equals the requester and that selected membership is still active; a revoked membership leaves the subject and workspace selection unchanged. After binding, ordinary session and product reads never update this row. Later `last_workspace_id` changes occur only through the explicit workspace-selection mutation and are conditional on the same bound subject, active user, active workspace and active membership.

## `workspace_memberships`

Links users to workspaces with an explicit role, status and non-negative record version. Server routes select only active memberships and active workspaces, and identity/workspace persistence repeats that check at its D1 write boundary so a concurrent suspension fails closed. Owner/admin member mutations use optimistic versions and a fixed protected target header. Owners cannot manage themselves, admins can manage only staff/viewer memberships, and database triggers reject any update or deletion that would leave a workspace without an active owner.

Private owner onboarding activates one existing non-archived owner workspace or creates one generic owner workspace. If it must change an existing membership's role or status, it increments the membership record version; an already active owner membership remains unchanged. It never seeds an identity or workspace in a migration. If the optional generation credit schema exists, onboarding may create a bounded non-monetary account without overwriting an existing ledger.

## `audit_events`

Reserved for meaningful state transitions. Read-only session resolution, Dashboard and activity-log requests do not create audit rows. Metadata must be small, structured and free of JWTs, email addresses, provider keys, prompts and private object URLs. The owner/admin activity API reads only the workspace-scoped event ID for internal seek pagination, normalized action, creation time and joined actor display name. Activity items omit event, target and request IDs plus all metadata; unknown actions and unsafe legacy display names become bounded generic values. A page contains at most 50 items and its private cursor is replayed only through a fixed protected header.

## `catalog_parts`

Stores workspace-scoped product identity, pricing, stock state and structured-specification verification status. SKU uniqueness is enforced within a workspace. A non-negative record version protects concurrent edits, while `status` supports logical archive without deleting records. A status-update trigger prevents an active part from becoming archived while its generated asset has an `awaiting_review` job with a reserved entitlement; this keeps the review path visible until human approval or rejection resolves the credit. No production catalogue rows are included in migrations.

## `product_assets`

Stores one current visual-asset review record per workspace catalogue part, including the canonical `front` source-image metadata and current GLB metadata. A `BEFORE INSERT` trigger requires the workspace-scoped catalogue part to remain active at the D1 creation boundary. A separate `BEFORE UPDATE` trigger enforces the same relationship for review, private-file replacement, exact file removal, generation staging and any direct asset mutation. This closes archive races after route validation: if archive commits first, the complete mutation batch aborts without a version, review, audit or credit transition. The review version supports optimistic concurrency. Source-rights confirmation, completed checklist identifiers and human-verified dimensions are stored independently from private source-image and GLB metadata.

Private file columns store opaque R2 object keys, validated content types, bounded byte sizes and SHA-256 checksums. Worker uploads also supply that digest to R2 for write-time integrity checking. Private-file reads require R2 existence, byte size, content type and checksum agreement before streaming; legacy objects without R2 SHA-256 metadata receive a bounded read-back, file validation and digest comparison. Asset approval always performs the bounded model read-back, repeats the GLB structure and self-containment validation, and compares the object SHA-256 with D1 before committing a review transition. Missing, invalid or drifted objects fail closed until an authorized replacement restores the exact validated bytes. Browser API records may expose only the validated content type and bounded size of each available slot; object keys and checksums never appear in API records, audit metadata, logs or checked-in fixtures.

## `product_asset_source_files`

Stores only the additional `back`, `left` and `three-quarter` source-image metadata. The composite workspace／asset／view key permits one current object per additional view and rejects any unenumerated value. Composite foreign keys keep each row attached to the matching workspace asset, while insert and update triggers require its catalogue part to remain active at the D1 boundary. A selected-view upload atomically increments the parent review version, resets all approval evidence and upserts one row; other source rows and the canonical front metadata remain unchanged. A selected-view removal conditionally updates the parent and deletes exactly the matching workspace／asset／view／object-key row in the same D1 batch; a changed version, key or catalogue state rolls back both. Replacement or removal cleans up only that previous exact R2 object after the batch commits. Deleting an asset cascades these metadata rows, but does not make any R2 object public.

## `asset_review_events`

Append-only review history for draft saves, approvals and rejections. Each asset version may appear once. The matching asset update, review event and minimal audit event are executed in one D1 batch.

## `builds`

Stores workspace-scoped draft identity, logical status, optimistic record version and a server-only mutation token. The token gates every selection statement in an update batch and is never returned by the API or written to audit metadata.

## `build_items`

Stores at most one selected catalogue part per build and component category. Composite foreign keys require the build, catalogue part and recorded category to belong to the same workspace. A referenced catalogue part keeps its category until every build reference is removed; other catalogue fields remain editable through optimistic version checks. Archived catalogue parts remain referentially intact for existing builds, while an insertion trigger rejects new selections if a part becomes inactive after application validation. Portable schema 2 serializes each selected part's current catalogue record version, making a later revision visible even though `build_items` remains a live reference rather than a historical snapshot.

## `generation_jobs`

Stores one durable, workspace-scoped orchestration record per explicit request. The record includes the asset, requester, unique idempotency key, unique Workflow instance ID, requested review version, input checksum, execution mode, zero monetary cap, provider cost-unit cap, state, stable failure/validation codes and private output metadata.

The browser representation omits the input checksum, Workflow ID, object keys, output checksum, requester and private attempt identifiers. It may return bounded provider-neutral cost units, entitlement state and a stable validation code; these values contain no price or provider identity. Failure and validation codes are nullable; every non-null value must contain 1–128 ASCII uppercase letters, digits or underscores and start with a letter. Migration `0015` validates existing non-null values in place and adds matching insert/update triggers for jobs, job events and provider-attempt validation results. Source R2 existence, size, content type and SHA-256 are checked before the reservation batch and again inside the Workflow before a provider attempt. A missing or checksum-drifted source at the second boundary records `GENERATION_INPUT_MISSING` and releases the entitlement once. A `BEFORE INSERT` trigger also requires the catalogue part to remain active and the asset status, review version, source checksum and saved rights confirmation to remain current at the reservation commit boundary. A stale insert aborts the complete batch, including the credit move and audit statements. A partial unique index permits at most one queued, running or validating job for a workspace asset, while the request guard also blocks a new job when an `awaiting_review` job still owns a reserved entitlement. An owner/admin cancellation may transition only `queued` to `cancelled`; the same guarded D1 batch releases the reservation, and a losing race against `running` changes neither state nor accounting. The currently valid execution mode is `simulation`; no external-provider identifier appears in the table or public domain model.

## `generation_job_events`

Stores append-only queued, running, validating, review-ready, failed or cancelled transitions. Metadata is bounded and may record safe geometry counts, dimensions, sizes, review versions, stable validation codes and integer cost-unit results only. It must not contain user identity, source or output object keys, checksums, prompts, provider responses or raw errors.

## `generation_credit_accounts`

Stores workspace-scoped non-monetary generation entitlement totals: available, reserved, settled and released units. Migration `0009` creates no account rows and grants no credit; provisioning remains an explicit administrative/product decision outside this milestone. Every value is non-negative. This table is not a wallet, invoice, payment balance or provider bill.

## `generation_job_entitlements`

Links exactly one bounded credit reservation to a generation job. Its terminal state is `settled` after asset approval or `released` after queued cancellation, rejection, failure, start failure or draft replacement. Guarded D1 batches allow only a `reserved` row to transition, so retries cannot settle or release the same unit twice.

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
- Submit a catalogue row and its minimal audit event in one D1 batch; CSV／TSV imports are all-or-nothing and contain at most 50 rows.
- Do not place object keys or checksums in audit events. Replacing a file must increment the review version and reset prior approval evidence.
- Build selection updates must use an expected version and server-only mutation token in one D1 batch.
- Catalogue archive must remain blocked while any linked generation entitlement is reserved; a denied archive must not increment the catalogue version or append an audit event.
- Generation requests must validate matching private source metadata before reserving an available entitlement, then persist the job, entitlement, credit event, initial job event and minimal audit record before triggering a Workflow. Idempotency is unique within the workspace.
- Generated output may update an asset only while its catalogue part remains active and its source checksum, saved rights confirmation and review version still match the requested input.
- Staging a generated draft must update the asset review version, job state, job event and minimal audit record in one guarded batch; output remains private and unapproved.
- Approval must settle a reserved entitlement; queued cancellation, rejection, terminal failure, start failure or generated-draft replacement must release it. Retried terminal transitions must make no additional account or event change.
- Provider attempt results must use the same attempt key, match an active job and transition only from `started`. Do not persist raw provider errors or payloads.
