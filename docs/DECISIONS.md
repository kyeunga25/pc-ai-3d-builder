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

Portable JSON includes component identity, verified specifications and bilingual compatibility evidence. It deliberately omits build and workspace identifiers, users, price, stock, private files, checksums and deployment values.

Build archive is a logical state transition with the same optimistic version boundary. The interface requires a separate second action before submitting it.

## Catalogue onboarding is bounded and transactional

Viewer roles remain read-only. Catalogue creation, update and logical archive use the resolved workspace context and minimal audit events. Existing rows require an optimistic record version. CSV imports validate every row before submitting at most 50 catalogue inserts and matching audit events in one D1 batch.

## Private object storage

Original images, uploaded GLB models and future render outputs use a private object binding. The browser receives file bytes only after Access and workspace verification, then uses a short-lived blob URL for the current page. It does not receive object keys, checksums, provider keys or permanent public object URLs.

Uploads are bounded to 10 MiB for JPEG, PNG or WebP source images and 25 MiB for self-contained glTF 2.0 GLB models. Replacing a file increments the review version and resets all checklist and dimension evidence.

The builder may decode only the selected component's approved GLB. It uses the protected file route and a revocable browser object URL; model geometry remains non-authoritative.

## Bounded asynchronous work

Long-running jobs use a swappable provider boundary and an idempotent Workflow. A generation request is accepted only after its workspace-scoped job, initial event and audit record commit. The Workflow uses unique instance IDs, bounded retry/timeout settings and guarded D1 transitions.

The current adapter creates a zero-cost synthetic GLB solely to exercise storage, validation and human-review transitions. Tracked production configuration disables it. A real provider requires another decision covering commercial terms, data rights, callbacks, cost reservation, settlement and a capped non-production test.

## Generated output remains review evidence

The Workflow validates a private output object before it changes any review record. The asset source checksum, saved rights confirmation and optimistic review version must still match. Staging increments the review version and resets checklist, dimensions and approval fields. It never marks an asset approved or modifies compatibility evidence.

Generation-job API records are provider-neutral and omit object keys, checksums, Workflow IDs, requester identity and cost details. Stable failure codes replace raw provider or platform errors.

## Payment remains a private future boundary

No payment route, UI, binding or ledger is active. The public source contains only generic types and a disabled adapter. Provider-specific checkout, signature, merchant mapping and credential code requires due diligence and an explicitly approved private server boundary.

## Read-only requests remain read-only

Session, workspace and dashboard reads do not append audit rows. Dashboard compatibility work is bounded to the latest 50 active drafts, and its recent-work response is capped at six items. Rate limiting is applied before protected database work, keyed by the verified Access subject.

## Public configuration is non-operational

Tracked Cloudflare configuration contains bindings and placeholders only. Deployment-specific values remain in Git-ignored local configuration or platform secrets.
