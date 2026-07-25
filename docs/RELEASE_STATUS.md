# Public release status — v0.2.0

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
- [x] D1 asset-review queue with role checks and optimistic concurrency.
- [x] Atomic asset, review-history and audit-event mutation batches.
- [x] D1 migrations and synthetic unit fixtures.
- [x] Placeholder-only private R2 and Workflow bindings.
- [x] Local check, test, build and deployment dry-run commands.
- [x] Production deploy command applies pending D1 migrations before Worker upload.

## Demonstration-only

Local catalogue records, prices, stock, review assets, compatibility results and the 3D scene are synthetic UI fixtures. Production catalogue and review routes read D1 records, but the repository contains no merchant records and does not provide catalogue onboarding. Private uploads, provider generation, compatibility decisions and exports remain inactive.

## Release checks

```bash
npm run check
npm run test
npm run build
npm run cf:dry-run
npm audit --audit-level=high
```

A release is not ready if any check fails, if deployment-specific configuration appears in tracked files, or if generated/private assets are staged.
