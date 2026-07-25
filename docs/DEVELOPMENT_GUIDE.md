# Developer brief

RigStage is an invite-only, merchant-facing PC catalogue and 3D assembly workspace. The public repository documents only implemented behavior and stable engineering boundaries.

## Current components

- React/Vite browser application with feature-oriented routes.
- Cloudflare Worker serving Static Assets and a small API.
- Cloudflare Access identity verification.
- D1 workspace membership, catalogue, asset-review history and audit schema.
- Workspace-scoped catalogue and asset-review APIs with bounded reads and mutation bodies.
- Private R2 and Workflow bindings reserved for approved asset workflows.
- Synthetic local UI fixtures for catalogue, review and builder demonstrations.

## Invariants

- Every protected server record is scoped to a verified workspace membership.
- An Access subject may bind to one invited user only.
- Provider keys and Cloudflare deployment identifiers never reach the browser or Git.
- Original images, generated models and render outputs remain private.
- Generated meshes remain drafts until explicit human approval.
- Asset-review writes require an authorized role and the current review version.
- Compatibility is determined from structured, verified specifications, never inferred from a visual mesh.
- Long-running work must be asynchronous and idempotent.
- Read-only requests must not create unbounded database writes.
- Tests and documentation use synthetic identities and data.

## Code organization

- `src/app/`: composition, routing and application shell.
- `src/features/`: feature-owned UI.
- `src/shared/`: reusable components, domain schemas and locale helpers.
- `src/worker/`: Access verification, workspace resolution, API routes and Workflow classes.
- `migrations/`: explicit D1 schema changes.
- `docs/`: public implementation documentation only.

## Completion checks

A change is complete when its error and loading states are represented, workspace access is enforced where required, relevant tests pass, production assets build, Wrangler dry-run succeeds, and the staged diff contains no secrets, real identities, deployment identifiers or generated private assets.

Production deployment prepares an ignored Wrangler configuration, applies pending D1 migrations, and uploads the Worker only after migration success.
