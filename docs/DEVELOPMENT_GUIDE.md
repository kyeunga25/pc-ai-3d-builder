# Developer brief

RigStage is an invite-only, merchant-facing PC catalogue and 3D assembly workspace. The public repository documents only implemented behavior and stable engineering boundaries.

## Current components

- React/Vite browser application with feature-oriented routes.
- Cloudflare Worker serving Static Assets and a small API.
- Cloudflare Access identity verification.
- D1 workspace membership, catalogue, asset-review history, persistent build and audit schema.
- Workspace-scoped dashboard, catalogue, asset-review and build APIs with bounded reads and mutation bodies.
- Catalogue create, optimistic update, logical archive and transactional CSV import.
- Private R2 source-image and GLB storage with protected Worker reads.
- Lazy-loaded Three.js GLB review and approved selected-component preview, plus a Workflow-backed, zero-cost synthetic generation validation path that remains disabled in tracked production configuration.
- A local-only generation milestone with non-monetary capability reservation, immutable provider-attempt records, strict GLB structure limits and Workers Runtime integration tests.
- Deterministic build compatibility and sanitized portable JSON export.
- Synthetic local UI fixtures for catalogue, review and builder demonstrations.

## Invariants

- Every protected server record is scoped to a verified workspace membership.
- An Access subject may bind to one invited user only.
- Provider keys and Cloudflare deployment identifiers never reach the browser or Git.
- Original images, generated models and render outputs remain private.
- Browser responses never expose R2 object keys, checksums or permanent object URLs.
- Generated meshes remain drafts until explicit human approval.
- Asset-review writes require an authorized role and the current review version.
- Catalogue writes require an authorized role and the current record version for existing rows.
- Build writes require an authorized role, one part per category and the current record version.
- Build export excludes identities, workspace IDs, price, stock and private asset metadata.
- Compatibility is determined from structured, verified specifications, never inferred from a visual mesh.
- Long-running work must be asynchronous and idempotent.
- Read-only requests must not create unbounded database writes.
- Dashboard reads must remain bounded and must not append audit events.
- Tests and documentation use synthetic identities and data.
- Generation starts only after a workspace-scoped job/event/audit commit, saved source-rights confirmation, current review version and explicit owner/admin action.
- Generation also requires one workspace-scoped capability credit. It is reserved once, settled once after approval, or released once after rejection, replacement or terminal failure; replaying a request cannot duplicate any transition.
- Generated output is checksum-validated, remains private, resets review evidence and cannot enter the Builder before human approval.
- Provider calls receive only pseudonymous generation/source references, a verified source descriptor and bounded output requirements. Internal workspace, user, asset and object identifiers stay outside the provider contract.
- Provider-attempt IDs are stable idempotency keys. Duplicate, late, conflicting and out-of-order callbacks or retries cannot create another cost or state transition.
- Generated GLB validation covers container/chunk structure, accessor and buffer-view bounds, node graph cycles, transformed dimensions, triangles, texture count/bytes and external URI rejection before and after private storage.
- Unknown generation configuration, non-zero simulation cost or the production kill switch fails closed before billable work.
- Payment remains disconnected and disabled; no browser route or public binding may create a payment object.

## Code organization

- `src/app/`: composition, routing and application shell.
- `src/features/`: feature-owned UI.
- `src/shared/`: reusable components, domain schemas and locale helpers.
- `src/worker/`: Access verification, workspace resolution, API routes and Workflow classes.
- `src/worker/generation/`: provider-neutral generation configuration and adapters; the public adapter is synthetic only.
- `test-worker/`: local Workers Runtime integration tests using real migrations, D1, R2 and Workflow bindings.
- `src/worker/payment/`: provider-neutral payment boundary; the public adapter is disabled only.
- `migrations/`: explicit D1 schema changes.
- `docs/`: public implementation documentation only.

## Completion checks

A change is complete when its error and loading states are represented, workspace access is enforced where required, relevant tests pass, production assets build, Wrangler dry-run succeeds, and the staged diff contains no secrets, real identities, deployment identifiers or generated private assets.

Production deployment prepares an ignored Wrangler configuration, applies pending D1 migrations, and uploads the Worker only after migration success.

## Local generation development

The browser-only fixture flow is the fastest manual check and never calls a Worker or provider:

```bash
npm run local:ai:start
```

Open the asset-review route, create the labelled synthetic PNG, save its synthetic rights declaration, start the synthetic generation, then approve or reject the draft. The page shows the available, reserved, settled and released capability counts and can hand an approved synthetic GLB to the Builder through local navigation state only.

The Worker-backed local flow uses local D1, R2 and Workflow state and the same built-in synthetic adapter:

```bash
npm run local:ai:debug
```

It applies migrations only to Wrangler's local state, uses placeholder local Access configuration without bypassing identity enforcement, and disables optional Wrangler usage telemetry for the local command. It does not contact an external AI provider, remote Cloudflare database or payment system. Run `npm run test:worker` for repeatable Workflow, retry, idempotency, settlement and release coverage; run `npm run local:ai:verify` for the full local quality suite.
