# Security policy

## Supported code

Security fixes apply to the latest code on the default branch.

The workspace is invite-only. The public landing page is static and does not request a session or contain merchant data. Production workspace routes require a Cloudflare Access application, valid Worker secrets, a migrated D1 database and an explicitly created workspace membership. The repository does not contain production account identifiers, resource names, user records or private assets.

The browser preview uses synthetic data only. Do not enter real merchant, customer, payment or private asset data into a local or preview environment.

## Security controls

- Access JWT signature, issuer, audience, expiry and subject are verified in the Worker.
- The public landing page performs no protected API request; workspace pages and every non-health API route remain behind Access.
- Protected records are resolved through active D1 workspace memberships.
- First-login identity binding rejects conflicting concurrent subjects.
- Protected API requests are rate-limited by verified Access subject.
- Session and workspace reads do not append audit events; first identity binding and an explicit workspace switch may update bounded user metadata.
- Catalogue and asset queries include the resolved workspace in every database predicate.
- Catalogue mutations use bounded bodies, role checks, optimistic versions and logical archive.
- Catalogue CSV imports validate the complete document before one transactional D1 batch.
- Private image and GLB uploads enforce role, workspace, MIME, binary signature and bounded-size checks; GLB files cannot reference external resources.
- R2 object keys and checksums remain server-only; authorized reads use `private, no-store` responses.
- File replacement requires the current review version and resets prior approval evidence.
- Asset review mutations use bounded JSON bodies, role checks and optimistic version conditions.
- Asset state, review history and the minimal audit event are committed in one D1 batch.
- Build reads and writes are workspace-scoped; explicit writes use bounded selections, optimistic versions and guarded D1 batches.
- Build export fails closed on hard errors or unknown compatibility results and excludes identities, workspace identifiers, prices, stock, private assets and deployment data.
- Dashboard aggregates are bounded, workspace-scoped and read-only; they do not append audit records or expose user identity data.
- Builder model previews request only an approved asset through the protected Worker route and revoke the short-lived object URL when the selected part changes.
- API responses use `no-store`; static and API responses receive restrictive security headers.
- Unexpected exceptions are logged with a stable code rather than raw error text.
- Production source maps and Wrangler telemetry are disabled.
- Provider keys, Access values and Cloudflare identifiers must stay outside Git.

## Dependencies

The supported branch uses React Router 8 and does not use React Server Components. Run the following before release:

```bash
npm audit --audit-level=high
npm run check
npm run test
npm run build
npm run cf:dry-run
```

Do not merge or deploy while a reachable high-severity advisory remains unresolved.

## Reporting a vulnerability

Use the repository Security tab to submit a private report. Do not open a public issue containing credentials, personal data, private object URLs, deployment identifiers or reproduction data from a real account.

Include the affected route or file, minimal reproduction steps, expected impact and redacted logs. Never include live tokens, JWTs, account identifiers, database identifiers or provider secrets.
