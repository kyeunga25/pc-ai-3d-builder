# Architecture

## Request path

```text
Browser
  -> public static landing page
  -> protected workspace route
     -> Cloudflare Access
     -> Worker
        -> protected API request
        -> verified Access identity
        -> subject-keyed rate limit
        -> D1 invited user and active memberships
        -> workspace-scoped API response
  -> Static Assets binding for the React application
```

The Worker handles `/api/*` before falling back to the built Vite application. Static Assets use single-page-application fallback. The `/` route is a static product introduction and makes no session request. Navigation to `/dashboard` is a full-page request so the configured Access application can perform its browser login flow before the protected React workspace loads.

## Authentication and tenancy

The Worker validates the Access assertion against the configured issuer and audience. It then resolves the active D1 user by bound subject or, for the first login only, by a verified invited email. Subject binding uses a conditional update and verifies the persisted winner before returning a context.

A requested workspace header never grants access by itself. The selected workspace must be present in the caller's active membership set.

## Storage bindings

D1 stores identity, workspace metadata, workspace-scoped catalogue records, private-file metadata, current asset review state, append-only review events and persistent build selections. Catalogue, asset and build mutations use expected versions and write their state transition and minimal audit event through D1 batches.

The R2 binding stores validated source images and self-contained GLB models under opaque keys. Objects are readable only through Access- and workspace-protected Worker routes; no bucket or permanent object URL is public. The Workflow binding exports a placeholder class but no HTTP route starts it and it performs no external generation work.

## Dashboard

The dashboard performs workspace-scoped aggregate reads only. Catalogue and asset counts are derived by bounded SQL queries. Compatibility readiness is evaluated from at most the latest 50 active build drafts and their selected catalogue records; the response returns at most six recent work items. It never creates a draft, appends an audit row or returns user identity.

## Catalogue and asset review

Catalogue reads are bounded to 100 rows per request and use an ID cursor. Staff, admin and owner roles may create, update or logically archive catalogue records; viewers remain read-only. Updates use optimistic record versions, and CSV imports validate at most 50 rows before submitting all catalogue and audit statements in one transactional D1 batch. The client-provided workspace header never becomes a database scope directly; the verified request context supplies the workspace predicate.

The review queue returns only draft or in-review assets in the active workspace. Viewer roles are read-only, staff may save drafts, and owner or admin roles may approve or reject. Approval requires a stored GLB model, the complete fixed checklist and three positive, bounded dimensions. Visual geometry remains non-authoritative for compatibility.

Catalogue staff can create an asset by uploading a validated source image. File replacement uses an expected review version, stores a new R2 object, commits safe metadata and a minimal audit event, then removes the superseded object. Any replacement resets prior checklist and dimension evidence. Three.js and GLB parsing are lazy-loaded only when an authorized model blob is available.

## Builds, compatibility and export

Build list reads are bounded to 50 records and never create data. Staff, admin and owner roles may explicitly create or update a draft with at most one active catalogue part from each of nine categories. Updates use an expected record version and a random server-side mutation token so stale D1 batch statements cannot replace a newer selection.

Compatibility is calculated at read time from current, verified structured specifications. Six fixed rules cover CPU socket, memory type, motherboard form factor, GPU clearance, cooler clearance and the recorded GPU power-supply recommendation. Missing selections, unverified specifications or absent required fields produce an `unknown` result rather than an inference.

Portable export is a read-only response and is blocked while any rule is `error` or `unknown`. The JSON contains product identity, verified specifications and bilingual rule evidence only. It omits build and workspace IDs, users, pricing, stock, asset metadata, R2 locations and deployment configuration.

The builder may preview the currently selected component only when its asset is approved. It retrieves the model through the same protected private-file route used by review, creates a page-local object URL and revokes it when the selection changes. The GLB remains visual evidence only and never changes a compatibility result.

## Privacy and observability

Logs contain request method, path, status, duration, request ID and stable error code only. They exclude JWTs, cookies, email addresses, prompts, provider responses and private object locations.

Tracked Wrangler configuration is a non-operational template. Actual deployment coordinates and secrets stay in an ignored local config or Cloudflare's secret store. Wrangler telemetry and dependency instrumentation are disabled.

## Frontend

The application uses feature-oriented React modules. The public landing route sits outside `SessionProvider`, so it cannot trigger a protected session read. Dashboard, catalogue, review and builder routes mount the session gate before rendering workspace content. The builder route is lazy-loaded so the general shell does not require its code before navigation; Three.js is loaded only when a private GLB is available. Production dashboard, catalogue, review and builder states use protected APIs, while local development uses explicit synthetic fixtures. Semantic controls, visible focus states, responsive layouts and reduced-motion rules are part of the shared design system.
