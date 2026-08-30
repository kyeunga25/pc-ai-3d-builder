# Release status — v1.1.0 baseline and local-development milestone

The first section records the tagged v1.1.0 public baseline. The second records public-safe source designed for local synthetic verification. Including this source in a deployed Worker does not enable production generation: the tracked production gate remains disabled, and local checks do not prove provider quality or remote readiness.

## Available in public v1.1.0

- [x] React, Vite and TypeScript application shell.
- [x] Traditional Chinese merchant interface with responsive and reduced-motion behavior.
- [x] Dashboard, catalogue, asset-review and lazy-loaded builder routes.
- [x] Live read-only dashboard metrics and recent work from the resolved workspace.
- [x] Cloudflare Worker health endpoint and Static Assets delivery.
- [x] Cloudflare Access verification and D1 workspace membership enforcement.
- [x] Concurrent identity-binding protection.
- [x] Subject-derived opaque API rate limiting without sending the raw identifier to the binding.
- [x] Bounded workspace-scoped catalogue API and production UI states.
- [x] Role-protected catalogue creation, optimistic update and logical archive.
- [x] Validated CSV template and transactional import of at most 50 records.
- [x] D1 asset-review queue with role checks and optimistic concurrency.
- [x] Four-view private R2 source-image and GLB upload with bounded binary validation, selected-view replacement and canonical-front generation isolation.
- [x] Shared Catalogue/Asset Review filename-MIME-bytes browser preflight with canonical upload MIME, safe empty/generic MIME recovery and independent Worker revalidation.
- [x] Access- and workspace-protected private-file streaming.
- [x] Lazy-loaded Three.js GLB preview with manual camera controls.
- [x] Builder preview of the selected component's approved private GLB with short-lived object URLs.
- [x] File replacement resets review evidence and removes one superseded object.
- [x] Atomic asset, review-history and audit-event mutation batches.
- [x] Explicit workspace-scoped build creation, switching and optimistic persistence.
- [x] Two-step logical archive for build drafts.
- [x] One selected catalogue part per component category, bounded to nine categories.
- [x] Six deterministic compatibility rules with bilingual evidence and fail-closed unknown states.
- [x] Portable JSON export without identity, workspace, pricing, stock, private-asset or deployment fields.
- [x] Export gate for hard errors, unknown rules and unsaved browser changes.
- [x] D1 migrations and synthetic unit fixtures.
- [x] Active private R2 and Workflow bindings with external-provider activity disabled.
- [x] Workspace-scoped generation-job and append-only event schema with unique idempotency and one-active-job constraints.
- [x] Owner/admin generation request API with current asset version, stored canonical-front source image and saved rights gate.
- [x] Zero-cost runtime synthetic adapter for controlled pipeline validation without source-image reads or external calls.
- [x] Workflow claim, bounded retry/timeout, private R2 write/read-back, GLB validation, checksum comparison and guarded draft staging.
- [x] Generated-output review-version increment and complete approval-evidence reset before `awaiting_review`.
- [x] Provider-neutral job status UI and local synthetic GLB test flow.
- [x] Tracked production generation kill switch defaults to disabled with a zero cost cap.
- [x] Provider-neutral payment interface with a disabled-only adapter and no route, binding, ledger or browser flow.
- [x] Local check, test, build and deployment dry-run commands.
- [x] Production deploy command applies pending D1 migrations before Worker upload.
- [x] Bilingual public issue forms, pull-request privacy checklist and support guidance.

## Local development milestone

- [x] Workspace-scoped asset-review queue continuation with 50-record D1 pages, header-only stable cursors, replay and cross-workspace guards, loaded-record navigation, unsaved-change blocking and retry-safe page failures.
- [x] Protected owner/admin workspace-member directory with 100-record header-only pagination, cancellable/retry-safe continuation, D1 invitations, role changes, reactivation, two-step suspension, optimistic versions and a database last-owner guard.
- [x] Protected owner/admin workspace activity log with 50-row pages, header-only pagination, bilingual filters and no raw audit metadata or visible private identifiers.
- [x] Two-step, optimistic removal of one selected private source view or GLB with atomic evidence reset, minimal audit, reserved-credit compensation and exact-key R2 cleanup.
- [x] Two-step owner/admin cancellation of one exact still-queued generation job with bodyless protected targets, conditional race safety, idempotent audit/event recording and exact-once reserved-credit release.
- [x] Scroll-bounded recent-generation history for at most 20 exact current-asset jobs, with bilingual state, entitlement and Hong Kong time but no visible job ID, diagnostic code, provider or private object detail.
- [x] CSV and TSV catalogue templates plus shared-schema, 256-KiB, 50-row transactional import with client preflight, exact registered media types and authoritative Worker revalidation.
- [x] Workspace-scoped, non-monetary generation capability accounts with reserve, settle and release transitions.
- [x] One customer capability unit and a one-unit provider-cost ceiling per local synthetic job, without price, currency, purchase or payment semantics.
- [x] Immutable provider-attempt records and stable provider idempotency references for duplicate, late, conflicting and out-of-order results.
- [x] Pseudonymous provider input that excludes workspace, user, asset, object and deployment identifiers.
- [x] Strict GLB validation for binary structure, buffer/accessor bounds, node graphs, transformed dimensions, triangles, textures and external resources.
- [x] Validation both before private R2 storage and after read-back, with stable public failure codes and private raw errors.
- [x] Exact-once reservation settlement after human approval and release after rejection, file replacement, exact file removal or terminal failure.
- [x] Workers Runtime integration tests using real migrations plus local D1, R2 and Workflow bindings, including forced transient retry.
- [x] A browser-only synthetic PNG-to-GLB-to-review-to-Builder path with visible capability state and no external calls.
- [x] A bounded Builder summary review scene for up to nine approved selected-component GLBs, with parallel private reads, partial success, abort-bound object URLs, local synthetic isolation and a one-canvas display-normalized grid that makes no installation or compatibility claim.
- [x] Explicit local development, migration, debugging and verification commands.

## Explicit boundaries

Local member identities, catalogue records, prices, stock, review assets, runtime simulation output and the builder fallback scene are synthetic UI fixtures. Production member, dashboard, catalogue, private-file, review, generation-job and build routes use workspace-scoped protected records, but the repository contains no merchant records, real identities or generated models. A D1 invitation does not update Cloudflare Access policy; exact-email Access admission remains a separate deployment-admin step. Compatibility, selected approved-model preview, the bounded multi-model review grid and portable export are active. The review grid normalizes display size and does not represent physical assembly, fit or scale. The synthetic adapter tests orchestration only and remains disabled in tracked production configuration. Capability credits are safety accounting only: they are not money, purchased usage or payment evidence. External provider generation, Workers AI automation, payment processing and mechanically constrained 3D assembly composition are neither v1.1 capabilities nor delivered by the local-development milestone.

## Release checks

```bash
npm run check
npm run test
npm run build
npm run cf:dry-run
npm audit --audit-level=high
```

A release is not ready if any check fails, if deployment-specific configuration appears in tracked files, or if generated/private assets are staged.
