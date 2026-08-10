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
- Protected API routing uses one exact path-and-method policy after Access and subject rate limiting but before workspace membership resolution. Unknown paths return one generic bilingual `404`; disallowed methods return bilingual `METHOD_NOT_ALLOWED` with the exact `Allow` header. Neither case reads a request body or reaches D1, R2 or Workflow bindings.
- Session and workspace reads for an already-bound identity do not update user metadata or append audit events; first identity binding is one bounded exception, while an explicit fixed-URL workspace-selection PUT conditionally updates only the selected preference. The client adopts only a matching successful session response, retains the previous verified scope after a target-only or transient failure, and still clears stale state on Access expiry, invite removal or identity-binding conflict.
- Catalogue and asset queries include the resolved workspace in every database predicate; selected asset detail and review targets use a bounded protected header with fixed URLs.
- Catalogue mutations and source-asset creation use fixed URLs plus a bounded protected part-ID header; role and target checks precede request-body, D1 and R2 work, while updates retain bounded bodies, optimistic versions and logical archive. Catalogue write, archive, asset-draft and CSV-import feedback uses typed bilingual status/alert copy; malformed or monolingual exceptions become operation-specific fallbacks, and an ambiguous response never claims that the server made no change.
- Catalogue CSV imports validate the complete document before one transactional D1 batch.
- JSON and CSV mutations require an exact, case-insensitive media-type token with optional parameters; prefix lookalikes fail before body materialization or mutation-route database work.
- Private image and GLB uploads enforce role, workspace, MIME and bounded-size checks. Source images also require bounded dimensions and structurally complete PNG chunks with CRCs, JPEG marker sequences or WebP RIFF chunks with still/animation bitstream headers; animated WebP is capped at 120 frames and 100 MP aggregate frame area. GLB files cannot reference external resources. These structural checks do not fully decode pixels and are not image-authenticity or visual-content moderation.
- R2 object keys and checksums remain server-only; authorized reads use a fixed URL, bounded protected asset/file-kind headers and `private, no-store` responses. Browser Blob URLs for remote private files are bound to the active request signal, revoked idempotently on abort or cleanup, and never created for a response that resolves after its workspace or asset scope was cancelled. Shared model-preview loading and failure states are bilingual but generic: a decode failure confirms that the file remains private without exposing parser or object details.
- File replacement rejects viewers before target/body/D1/R2 work, requires the current review version plus an active catalogue part at the D1 write boundary, and resets prior approval evidence. The bilingual client warning scopes the action accurately: only the selected file kind is replaced, while the other private file remains private and unchanged.
- Asset review mutations reject viewers before target/body/D1/R2 work, validate a bounded protected target before the JSON body, and retain optimistic version conditions plus an active-catalogue database trigger. Client feedback for save, approve, reject, private-file upload and simulated generation is typed and bilingual; the domain-enumerated approval checklist, verified-dimension labels, human-verification guidance and completion count are bilingual as well. Header and inspector copy exhaustively maps every review status, source kind and quality value, while version and queue context expose no asset identifier. These visible labels describe client state only and never replace the Worker's workspace, role, persisted-state, model-integrity or approval-evidence checks. The source filmstrip labels authorized/missing private-image state and current usage-rights evidence bilingually without exposing the asset ID; its success or warning presentation does not weaken the Worker's independent saved-rights, complete-checklist and positive-dimension requirements. Malformed or monolingual exceptions become operation-specific alert copy, and ambiguous responses require a reload instead of claiming that no write or job occurred. Rejection requires two button activations for the same workspace, asset and review version; the first sends no mutation, while its warning states that a reserved credit may be released and private files remain stored. This confirmation prevents accidental activation only and does not replace server-side authorization or optimistic locking.
- Asset state, review history and the minimal audit event are committed in one D1 batch.
- Build reads and writes are workspace-scoped; selected build IDs use a bounded protected header with fixed API URLs, and explicit writes use bounded selections, optimistic versions and guarded D1 batches. Create, switch, save, two-step archive and export states are bilingual and use typed info/success/warning/error announcements; malformed or monolingual client exceptions are replaced with operation-specific safe copy that states whether data or a download changed. The bilingual inspector is a read-only projection of the already scoped catalogue part and compatibility findings. It exhaustively maps bounded status enums, does not render build or asset IDs, and never upgrades an unverified specification or non-approved visual asset.
- The bilingual Builder command bar derives workspace, build, navigation, create, two-step archive and inspector labels from one typed presentation contract. Viewer rendering withholds create and archive controls, while server-side role checks remain authoritative. Compact icon controls keep accessible bilingual names, and visible labels never substitute a private build ID for its workspace-scoped display name. The responsive modal drawer reuses only the already scoped read-only inspector projection; opening it performs no additional data fetch or write and exposes no new identifier.
- The bilingual Builder component rail is also a read-only projection until the existing explicit save action runs. Viewer candidates remain disabled; its copy states that only current-workspace catalogue records are used, preserves compatibility-state precedence, distinguishes unverified stock from availability and renders SKU rather than private part or asset IDs.
- The bilingual Builder status bar is presentation only: its error, unknown, warning and success precedence cannot authorize a save or export. It exposes no protected identifier, keeps icon-only actions accessibly named, and states that portable export excludes identity, pricing, stock and private assets. The Worker independently re-evaluates the build and fails closed even if client state is stale or altered.
- Build export fails closed on hard errors or unknown compatibility results and excludes identities, workspace identifiers, prices, stock, private assets and deployment data.
- Dashboard aggregates are bounded, workspace-scoped and read-only; they do not append audit records or expose user identity data. Each recent-work item requires bounded Traditional Chinese and English detail/status fields, while its protected asset target remains separate from the fixed public-facing route and visible copy.
- Builder model previews request only an approved asset through the protected Worker route and revoke the short-lived object URL when the selected part changes. Their typed bilingual states distinguish authorized private loading, local synthetic preparation, private-load failure and static fallback without rendering workspace or asset IDs, parser detail or object coordinates. These presentation states never promote a model or alter compatibility evidence.
- Generation reads and requests use a fixed URL plus a bounded protected asset target; requests reject non-owner/admin roles before the target and validate it before the idempotency key, body, D1, R2 or Workflow, while still requiring saved source rights, the current asset version, a unique idempotency key and the verified workspace before commit. Public failure and validation fields accept only 1–128 ASCII uppercase letters, digits or underscores in the shared response schema; D1 triggers enforce the same rule on generation-job, event and provider-attempt inserts and updates so raw internal text cannot become a stored public diagnostic.
- One active generation job is allowed per asset; the tracked kill switch is disabled and the current simulation cost cap is zero.
- Workflow output is private, size/signature/structure/checksum validated and staged only while its source checksum and review version remain current.
- Generated output resets all review evidence and remains unavailable to the Builder until a new human approval.
- Job responses and audits exclude object keys, checksums, Workflow IDs, raw errors and provider references. The review inspector labels every mode, lifecycle and entitlement state bilingually, describes credit as non-monetary, and displays only the already bounded validation code rather than raw provider detail.
- Payment is not reachable: the public payment adapter is disabled and has no route, binding, ledger or browser control.
- API responses use `no-store`; static and API responses receive restrictive security headers.
- Public API errors require Traditional Chinese and English copy at construction, retain only a stable code and per-request ID, and map detailed CSV, image and GLB parser failures to bounded user-safe messages. Internal labels, record identifiers and parser details are not copied into the public message.
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
