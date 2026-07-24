# Public release status

This file records only the capabilities present in the current public branch.

## Available

- [x] React, Vite and TypeScript application shell.
- [x] Traditional Chinese merchant interface with responsive and reduced-motion behavior.
- [x] Dashboard, catalogue, asset-review and lazy-loaded builder routes.
- [x] Cloudflare Worker health endpoint and Static Assets delivery.
- [x] Cloudflare Access verification and D1 workspace membership enforcement.
- [x] Concurrent identity-binding protection.
- [x] Subject-keyed API rate limiting.
- [x] D1 migrations and synthetic unit fixtures.
- [x] Placeholder-only private R2 and Workflow bindings.
- [x] Local check, test, build and deployment dry-run commands.

## Demonstration-only

The catalogue records, prices, stock, compatibility results and 3D scene are synthetic UI fixtures. They are not live merchant data and are not presented as completed backend workflows.

## Release checks

```bash
npm run check
npm run test
npm run build
npm run cf:dry-run
npm audit --audit-level=high
```

A release is not ready if any check fails, if deployment-specific configuration appears in tracked files, or if generated/private assets are staged.
