# Product behavior

RigStage is an invite-only browser workspace for computer merchants. The current public build demonstrates catalogue browsing, asset-review states and a PC assembly interface using synthetic data.

## Implemented behavior

- Traditional Chinese interface with HKD formatting.
- Workspace-scoped session resolution through Cloudflare Access and D1.
- Dashboard, catalogue, asset review and builder routes.
- Synthetic compatibility and build status presentation.
- Clear draft, review and approved labels for visual assets.
- Human approval remains mandatory before generated material is treated as usable.

## Boundaries

- The application is not CAD, thermal simulation or mechanical validation software.
- A visual mesh never establishes compatibility.
- Prices, inventory, components and customer information shown in the demo are fictional.
- No public marketplace, payment flow or customer-data collection is enabled.
- Private uploads and real provider generation are not enabled in this release.

## Data handling

Protected data must remain scoped to one verified workspace. Provider secrets and Cloudflare deployment identifiers stay in platform secrets or Git-ignored local configuration. Original images, generated models and render outputs must remain private until an authorized server path grants temporary access.
