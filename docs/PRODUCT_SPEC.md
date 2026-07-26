# Product behavior

RigStage is an invite-only browser workspace for computer merchants. Version 1.0 provides a usable human-reviewed workflow from workspace catalogue onboarding and private visual assets to persistent PC builds, deterministic compatibility evidence and privacy-bounded export.

## Implemented behavior

- Traditional Chinese interface with HKD formatting.
- Workspace-scoped session resolution through Cloudflare Access and D1.
- Live workspace dashboard plus catalogue, asset review and builder routes.
- Bounded, read-only dashboard aggregates with recent review and build work.
- Bounded catalogue pagination and review-queue reads from the resolved workspace.
- Role-protected catalogue creation, optimistic updates and logical archive.
- Validated CSV template download and transactional import of at most 50 catalogue records.
- Draft saves for staff, with approval and rejection reserved for owner or admin roles.
- Optimistic asset versions and append-only review and audit events.
- Private source-image and GLB upload with signature, MIME and size validation.
- Authorized private-file reads and manual Three.js GLB inspection without permanent object URLs.
- Explicit build creation, switching and optimistic persistence for one selected part per category.
- Two-step logical archive for build drafts.
- Deterministic compatibility findings from six verified structured-specification rules.
- Protected preview of the selected component's approved GLB in the builder.
- Portable JSON export that fails closed and excludes identity, operational and private-asset fields.
- Clear draft, review and approved labels for visual assets.
- Human approval remains mandatory before generated material is treated as usable.

## Boundaries

- The application is not CAD, thermal simulation or mechanical validation software.
- A visual mesh never establishes compatibility.
- Prices, inventory and components shown in local development are fictional.
- No public marketplace, payment flow or customer-data collection is enabled.
- External provider generation and multi-model 3D scene composition are optional future integrations, not v1.0 product capabilities.

## Data handling

Protected data must remain scoped to one verified workspace. Provider secrets and Cloudflare deployment identifiers stay in platform secrets or Git-ignored local configuration. Original images, generated models and render outputs must remain private until an authorized server path grants temporary access.
