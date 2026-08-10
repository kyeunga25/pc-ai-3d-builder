# Security policy

## Supported code

Security fixes apply to the latest code on the default branch.

The workspace is invite-only. The public landing page is static and does not request a session or contain merchant data. Production workspace routes require a Cloudflare Access application, valid Worker secrets, a migrated D1 database and an explicitly created workspace membership. The repository does not contain production account identifiers, resource names, user records or private assets.

The browser preview uses synthetic data only. Do not enter real merchant, customer, payment or private asset data into a local or preview environment.

## Public documentation boundary

- Documentation, examples, screenshots and support material must use placeholders or clearly labelled synthetic data only.
- Never publish AI-assistant prompts, conversation text, private operating notes, real application data, credentials, Access values, deployment coordinates, private URLs, database exports or internal operational topology.
- Self-hosting values belong in Git-ignored local files or Cloudflare secrets. Treat resource names and identifiers as private even when they are not authentication credentials.
- Public documents may describe the logical components required to understand and deploy the checked-in source, but must not claim to conceal implementation that is already visible in source code or migrations. Keep the repository private if the logical architecture itself is confidential.
- Review generated or AI-assisted documentation as untrusted input before commit. Confirm every capability, dependency, model and data-source statement against the repository and official primary documentation.

## Security controls

- Access JWT signature, issuer, audience, expiry and identity-based application-token type are verified in the Worker. Assertions are capped at 16 KiB; normalized subjects, emails and display names are capped at 256, 254 and 128 characters, reject control characters, and fail before Rate Limiting or D1 when invalid.
- The public landing page performs no protected API request; workspace parent and deep routes run through Worker authentication before Static Assets, and every non-health API route remains behind Access.
- Protected records are resolved through active D1 workspace memberships.
- First-login identity binding rejects conflicting concurrent subjects.
- Protected API requests are rate-limited by a versioned, domain-separated SHA-256 key derived from the verified Access subject; the raw subject is not sent to the Rate Limiting binding or request logs.
- Session and workspace reads do not append audit events; first identity binding and an explicit workspace switch may update bounded user metadata.
- Catalogue and asset queries include the resolved workspace in every database predicate.
- Catalogue mutations use bounded bodies, role checks, optimistic versions and logical archive.
- Catalogue CSV imports validate the complete document before one transactional D1 batch.
- JSON and CSV mutations require an exact, case-insensitive media-type token with optional parameters; prefix lookalikes fail before body materialization or mutation-route database work.
- Private image and GLB uploads enforce role, workspace, MIME and bounded-size checks. Source images also require bounded dimensions and structurally complete PNG chunks with CRCs, JPEG marker sequences or WebP RIFF chunks with still/animation bitstream headers; animated WebP is capped at 120 frames and 100 MP aggregate frame area. GLB files cannot reference external resources. These structural checks do not fully decode pixels and are not image-authenticity or visual-content moderation.
- R2 object keys and checksums remain server-only; authorized reads use `private, no-store` responses.
- File replacement requires the current review version, an active catalogue part at the D1 write boundary and resets prior approval evidence.
- Asset review mutations use bounded JSON bodies, role checks, optimistic version conditions and an active-catalogue database trigger.
- Asset state, review history and the minimal audit event are committed in one D1 batch.
- Build reads and writes are workspace-scoped; selected build IDs use a bounded protected header with fixed API URLs, and explicit writes use bounded selections, optimistic versions and guarded D1 batches.
- Build export fails closed on hard errors or unknown compatibility results and excludes identities, workspace identifiers, prices, stock, private assets and deployment data.
- Dashboard aggregates are bounded, workspace-scoped and read-only; they do not append audit records or expose user identity data.
- Builder model previews request only an approved asset through the protected Worker route and revoke the short-lived object URL when the selected part changes.
- Generation requests require owner/admin role, saved source rights, the current asset version, a unique idempotency key and the verified workspace before a job is committed.
- One active generation job is allowed per asset; the tracked kill switch is disabled and the current simulation cost cap is zero.
- Workflow output is private, size/signature/structure/checksum validated and staged only while its source checksum and review version remain current.
- Generated output resets all review evidence and remains unavailable to the Builder until a new human approval.
- Job responses and audits exclude object keys, checksums, Workflow IDs, raw errors and provider references.
- Payment is not reachable: the public payment adapter is disabled and has no route, binding, ledger or browser control.
- API responses use `no-store`; static and API responses receive restrictive security headers.
- Unexpected exceptions are logged with a stable code rather than raw error text.
- Production source maps and Wrangler telemetry are disabled.
- Provider keys, Access values and Cloudflare identifiers must stay outside Git.
- Private owner onboarding reads the exact login identity only from a private environment, requires a mode-`0600` ignored deployment config with alternate public Worker URLs disabled, and suppresses Wrangler output that could contain identity or resource mappings.

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
