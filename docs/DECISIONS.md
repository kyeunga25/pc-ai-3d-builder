# Architecture decisions

## Access identity plus D1 membership

Cloudflare Access protects the application boundary. The Worker independently verifies the Access JWT and resolves an invited active user and workspace membership for each protected request. It does not auto-provision unknown users.

## Human approval before asset use

Generated visual material remains a draft until an authorized user approves it. The application must not present inferred geometry as verified product or engineering data.

Staff roles may save review drafts. Approval and rejection require an owner or admin role, the current optimistic review version and an atomic asset, review-history and audit-event batch. Approval also requires every fixed checklist item and three positive human-verified dimensions.

## Compatibility from structured data

Compatibility decisions use verified specifications and deterministic rules. A visual mesh is never an authority for sockets, power, clearance or connectors.

The active rules cover CPU socket, memory type, motherboard form factor, GPU length, cooler height and the GPU vendor's recorded PSU recommendation. A missing selection, unverified record or missing required field produces `unknown`. Hard errors and unknown results block portable export; a PSU recommendation shortfall remains an explicit warning rather than an invented electrical calculation.

## Persistent builds and portable export

A build selects at most one active catalogue part per component category. Reads are bounded and do not auto-create a draft. Explicit writes use an optimistic record version plus a server-only mutation token to gate the complete D1 selection batch.

Portable schema-2 JSON includes the build record version, each component's current catalogue record version, component identity, verified specifications and bilingual compatibility evidence. It deliberately omits build and workspace identifiers, users, price, stock, private files, checksums and deployment values. The revision fields improve traceability but do not claim an immutable snapshot or content digest.

Build archive is a logical state transition with the same optimistic version boundary. The interface requires a separate second action before submitting it. Every create, switch, save, archive and export state uses centrally enumerated Traditional Chinese and English copy plus an explicit info, success, warning or error tone. Failures use alert semantics instead of the success indicator. Raw monolingual client exceptions are not treated as user-facing instructions; an operation-specific fallback explicitly reports no data, current-build or download change.

## Catalogue onboarding is bounded and transactional

Viewer roles remain read-only. Catalogue creation, update and logical archive use the resolved workspace context and minimal audit events. Existing rows require an optimistic record version. CSV imports validate every row before submitting at most 50 catalogue inserts and matching audit events in one D1 batch.

## Private object storage

Original images, uploaded GLB models and future render outputs use a private object binding. The browser receives file bytes only after Access and workspace verification, then uses a short-lived blob URL for the current page. Each remote-file URL is bound to that request's abort signal and is revoked idempotently on workspace/asset change or unmount; a response arriving after cancellation does not materialize a URL. The browser does not receive object keys, checksums, provider keys or permanent public object URLs.

Uploads are bounded to 10 MiB for JPEG, PNG or WebP source images and 25 MiB for self-contained glTF 2.0 GLB models. Source images must match their MIME type, remain within the 32,768 px edge and 100 MP safety bounds, and pass format-specific container checks before storage; animated WebP is capped at 120 frames and 100 MP aggregate frame area. This rejects signatures without complete PNG chunks, JPEG marker/scan closure or WebP still/animation bitstream headers, but deliberately does not claim pixel-level decoding, provenance verification or content moderation. Replacing a file increments the review version and resets all checklist and dimension evidence.

The builder may decode only the selected component's approved GLB. It uses the protected file route and an abort-bound, revocable browser object URL; model geometry remains non-authoritative.

## Public errors are bilingual and bounded

Every public API failure keeps a stable machine code and request ID while presenting Traditional Chinese first and English second. A shared construction guard rejects single-language public copy. Validation layers may keep detailed internal diagnostics for control flow, but CSV parser state, GLB structure labels, raw exceptions and private identifiers are reduced to bounded corrective categories before serialization. This preserves actionable error handling without turning parser details into a public debugging channel.

## Bounded asynchronous work

Long-running jobs use a swappable provider boundary and an idempotent Workflow. A generation request is accepted only after its workspace-scoped job, initial event and audit record commit. The Workflow uses unique instance IDs, bounded retry/timeout settings and guarded D1 transitions.

The current adapter creates a zero-cost synthetic GLB solely to exercise storage, validation and human-review transitions. Tracked production configuration disables it. The local-development milestone reserves one non-monetary capability unit and caps provider work at one neutral cost unit. A real provider still requires another decision covering commercial terms, data rights, callbacks and a capped non-production test; capability accounting is not a payment ledger.

## Generated output remains review evidence

The Workflow validates a private output object before it changes any review record. The asset source checksum, saved rights confirmation and optimistic review version must still match. Staging increments the review version and resets checklist, dimensions and approval fields. It never marks an asset approved or modifies compatibility evidence.

Generation-job API records are provider-neutral and omit object keys, checksums, Workflow IDs, requester identity, currency and price. They may expose a bounded neutral provider-cost unit and capability state so an authorized reviewer can understand reservation and settlement. Stable failure codes replace raw provider or platform errors.

## Payment remains a private future boundary

No payment route, UI, binding or ledger is active. The public source contains only generic types and a disabled adapter. Provider-specific checkout, signature, merchant mapping and credential code requires due diligence and an explicitly approved private server boundary.

## Read-only requests remain read-only

After the one-time invited-identity binding, session, workspace, dashboard and product reads do not update user preference metadata or append audit rows. A requested workspace header scopes only that request; persistence requires the explicit fixed-URL workspace-selection PUT, whose conditional update rechecks the verified subject and active membership. This prevents two tabs reading different workspaces from repeatedly rewriting `last_workspace_id`. The browser keeps the previous verified session until a matching target response succeeds; recoverable selection failure is an inline retry state rather than a reason to discard unrelated active membership, while global identity denial still clears the session. Dashboard compatibility work is bounded to the latest 50 active drafts, and its recent-work response is capped at six items. Rate limiting is applied before protected database work, keyed by a versioned domain-separated SHA-256 digest of the verified Access subject rather than the raw identifier.

## Invalid API requests stop before tenancy lookup

One exact route-and-method policy defines every API endpoint. The public health endpoint is handled separately. All other API paths retain Access verification and subject-keyed rate limiting so unknown paths cannot bypass the protected boundary, but a generic unknown-path response or a method-specific bilingual `405` is returned before active workspace membership resolution. This avoids request-body, D1, R2 and Workflow work for a request that cannot be dispatched, while exact `Allow` headers keep the supported method contract reviewable.

## Public configuration is non-operational

Tracked Cloudflare configuration contains bindings and placeholders only. Deployment-specific values remain in Git-ignored local configuration or platform secrets.
