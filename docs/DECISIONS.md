# Architecture decisions

## Access identity plus D1 membership

Cloudflare Access protects the application boundary. The Worker independently verifies the Access JWT and resolves an invited active user and workspace membership for each protected request. It does not auto-provision unknown users.

## Human approval before asset use

Generated visual material remains a draft until an authorized user approves it. The application must not present inferred geometry as verified product or engineering data.

Staff roles may save review drafts. Approval and rejection require an owner or admin role, the current optimistic review version and an atomic asset, review-history and audit-event batch. Approval also requires every fixed checklist item and three positive human-verified dimensions.

## Compatibility from structured data

Compatibility decisions use verified specifications and deterministic rules. A visual mesh is never an authority for sockets, power, clearance or connectors.

## Private object storage

Original images, generated models and render outputs use a private object binding. The browser does not receive provider keys or permanent public object URLs.

## Bounded asynchronous work

Long-running jobs use a swappable provider boundary and an idempotent Workflow. The current Workflow is a placeholder and has no provider side effects.

## Read-only requests remain read-only

Session and workspace reads do not append audit rows. Rate limiting is applied before protected database work, keyed by the verified Access subject.

## Public configuration is non-operational

Tracked Cloudflare configuration contains bindings and placeholders only. Deployment-specific values remain in Git-ignored local configuration or platform secrets.
