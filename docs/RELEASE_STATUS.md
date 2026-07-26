# Public release status — v0.4.0

This file records only the capabilities present in the current public branch.

## Available

- [x] React, Vite and TypeScript application shell.
- [x] Traditional Chinese merchant interface with responsive and reduced-motion behavior.
- [x] Dashboard, catalogue, asset-review and lazy-loaded builder routes.
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
- [x] File replacement resets review evidence and removes one superseded object.
- [x] Atomic asset, review-history and audit-event mutation batches.
- [x] D1 migrations and synthetic unit fixtures.
- [x] Active private R2 binding and placeholder-only Workflow binding.
- [x] Local check, test, build and deployment dry-run commands.
- [x] Production deploy command applies pending D1 migrations before Worker upload.

## Demonstration-only

Local catalogue records, prices, stock, review assets, compatibility results and the builder scene are synthetic UI fixtures. Production catalogue, private-file and review routes use workspace-scoped D1 and R2 records, but the repository contains no merchant records or generated models. Provider generation, compatibility decisions and exports remain inactive.

## Release checks

```bash
npm run check
npm run test
npm run build
npm run cf:dry-run
npm audit --audit-level=high
```

A release is not ready if any check fails, if deployment-specific configuration appears in tracked files, or if generated/private assets are staged.
