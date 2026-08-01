# Public release status — v1.1.0

This file records only the capabilities present in the current public branch.

## Available

- [x] React, Vite and TypeScript application shell.
- [x] Traditional Chinese merchant interface with responsive and reduced-motion behavior.
- [x] Dashboard, catalogue, asset-review and lazy-loaded builder routes.
- [x] Live read-only dashboard metrics and recent work from the resolved workspace.
- [x] Cloudflare Worker health endpoint and Static Assets delivery.
- [x] Cloudflare Access verification and D1 workspace membership enforcement.
- [x] Concurrent identity-binding protection.
- [x] Subject-keyed API rate limiting.
- [x] Bounded workspace-scoped catalogue API and production UI states.
- [x] Role-protected catalogue creation, optimistic update and logical archive.
- [x] Validated CSV template and transactional import of at most 50 records.
- [x] D1 asset-review queue with role checks and optimistic concurrency.
- [x] Private R2 source-image and GLB upload with bounded binary validation.
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
- [x] Owner/admin generation request API with current asset version, stored source image and saved rights gate.
- [x] Zero-cost runtime synthetic adapter for controlled pipeline validation without source-image reads or external calls.
- [x] Workflow claim, bounded retry/timeout, private R2 write/read-back, GLB validation, checksum comparison and guarded draft staging.
- [x] Generated-output review-version increment and complete approval-evidence reset before `awaiting_review`.
- [x] Provider-neutral job status UI and local synthetic GLB test flow.
- [x] Tracked production generation kill switch defaults to disabled with a zero cost cap.
- [x] Provider-neutral payment interface with a disabled-only adapter and no route, binding, ledger or browser flow.
- [x] Local check, test, build and deployment dry-run commands.
- [x] Production deploy command applies pending D1 migrations before Worker upload.
- [x] Bilingual public issue forms, pull-request privacy checklist and support guidance.

## Explicit boundaries

Local catalogue records, prices, stock, review assets, runtime simulation output and the builder fallback scene are synthetic UI fixtures. Production dashboard, catalogue, private-file, review, generation-job and build routes use workspace-scoped D1 and R2 records, but the repository contains no merchant records or generated models. Compatibility, selected approved-model preview and portable export are active. The synthetic adapter tests orchestration only and remains disabled in tracked production configuration. External provider generation, Workers AI automation, payment processing and multi-model 3D scene composition are not v1.1 capabilities.

## Release checks

```bash
npm run check
npm run test
npm run build
npm run cf:dry-run
npm audit --audit-level=high
```

A release is not ready if any check fails, if deployment-specific configuration appears in tracked files, or if generated/private assets are staged.
