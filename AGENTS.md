# Contribution guidance for RigStage

## Safety and repository discipline

- Run `git status -sb` before editing.
- Do not bulk-delete files or directories.
- Never commit secrets, personal data, deployment-specific configuration, generated GLB files, local databases or private operational notes.
- Do not overwrite unrelated user changes.
- Stage only files relevant to the current task.
- Use explicit migrations for D1 schema changes.
- Use synthetic fixtures in tests and screenshots.
- Do not deploy unless explicitly requested.

## Read before implementation

1. `README.md`
2. `SECURITY.md`
3. `docs/ARCHITECTURE.md`
4. `docs/DATA_MODEL.md`
5. `docs/API_SPEC.md`
6. `docs/TEST_PLAN.md`

## Product invariants

- The app is invite-only.
- Every protected record is scoped to an active workspace membership.
- Generated meshes remain drafts until human approval.
- Compatibility is never inferred from a visual mesh.
- Verified source data overrides extracted or synthetic data.
- Original images, models and render outputs remain private.
- Provider keys and deployment values never reach the browser.
- External providers sit behind swappable server interfaces.
- Long-running work is asynchronous and idempotent.
- Read-only requests do not create unbounded writes.

## Required checks

```bash
npm run check
npm run test
npm run build
npm run cf:dry-run
npm audit --audit-level=high
```

When Cloudflare configuration changes, retrieve current official documentation and validate against the installed Wrangler schema.

## Frontend rules

- Keep `App` as composition glue and organize code by feature.
- Lazy-load the builder route and optional 3D code.
- Use semantic HTML and keyboard-accessible controls.
- Respect `prefers-reduced-motion`.
- Keep the dark interface readable and preserve the viewport as the primary builder area.

## Cloudflare rules

- Use bindings instead of REST calls from inside the Worker.
- Keep R2 objects private.
- Use D1 for relational metadata and explicit state transitions.
- Use Workflows for long-running jobs.
- Apply subject-keyed rate limits before protected database work.
- Use generated Worker binding types.
- Keep actual deployment coordinates in Git-ignored local configuration.
- Disable telemetry or metadata collection that is not required.

## Definition of done

A feature is complete only when failure states are represented, workspace access is enforced server-side, tests cover the business rule, checks pass, and the staged diff contains no secret, real identity, deployment-specific value, private operational note or generated asset.
