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

The Worker handles `/api/*` and each protected workspace parent/deep route before falling back to the built Vite application. Static Assets use single-page-application fallback. The `/` route is a static product introduction and makes no session request. Navigation to `/dashboard` is a full-page request so the configured Access application can perform its browser login flow before the Worker independently validates the JWT and active D1 membership, then serves the private React shell with `private, no-store` caching.

## Authentication and tenancy

The Worker validates the Access assertion against the configured issuer and a bounded allowlist of application audiences. A single audience remains the default; deployments that must split the documented private paths across multiple Access applications may store a comma-separated secret allowlist without publishing any audience value. It then resolves the active D1 user by bound subject or, for the first login only, by a verified invited email. Subject binding uses a conditional update that rechecks the active user, selected workspace and membership at the write boundary. A zero-row result re-reads both the subject winner and active membership: a different subject fails as a binding conflict, while revoked access leaves the subject unbound. Persisting a workspace switch is guarded by the same subject and active-membership conditions.

A requested workspace header never grants access by itself. The selected workspace must be present in the caller's active membership set.

All browser API requests include `X-Requested-With: XMLHttpRequest`, allowing Access to return a bounded `401` when an application session expires. The client then requires a top-level re-login navigation. Logout uses Cloudflare Access's same-origin `/cdn-cgi/access/logout` endpoint; the application does not create a parallel session or identity bypass.

Owner provisioning is an out-of-band private operation. The tracked tool reads the exact login identity only from a private environment, writes a short-lived mode-`0600` SQL file, executes it through Wrangler against the configured D1 binding, verifies only a boolean owner result and removes the temporary file. It never returns the identity, private SQL or deployment coordinates.

## Storage bindings

D1 stores identity, workspace metadata, workspace-scoped catalogue records, private-file metadata, current asset review state, append-only review events, generation jobs/events, generation credit entitlements, provider-attempt state and persistent build selections. Catalogue, asset, generation and build mutations use expected versions or idempotency keys and write their state transition and minimal audit event through D1 batches.

The R2 binding stores validated source images and self-contained GLB models under opaque keys. Objects are readable only through Access- and workspace-protected Worker routes; no bucket or permanent object URL is public. The Workflow binding can run the zero-cost synthetic validation pipeline when an explicitly controlled environment selects simulation mode. Tracked production configuration remains disabled, and the current Workflow performs no external provider or Workers AI call.

## Dashboard

The dashboard performs workspace-scoped aggregate reads only. Catalogue and asset counts are derived by bounded SQL queries. Compatibility readiness is evaluated from at most the latest 50 active build drafts and their selected catalogue records; the response returns at most six recent work items. It never creates a draft, appends an audit row or returns user identity.

## Catalogue and asset review

Catalogue reads are bounded to 100 rows per request and use an ID cursor. Staff, admin and owner roles may create, update or logically archive catalogue records; viewers remain read-only. Updates use optimistic record versions, and CSV imports validate at most 50 rows before submitting all catalogue and audit statements in one transactional D1 batch. The client-provided workspace header never becomes a database scope directly; the verified request context supplies the workspace predicate.

The review queue returns only draft or in-review assets in the active workspace. Viewer roles are read-only, staff may save drafts, and owner or admin roles may approve or reject. Approval requires a stored GLB model, the complete fixed checklist and three positive, bounded dimensions. Visual geometry remains non-authoritative for compatibility.

Catalogue staff can create an asset by uploading a validated source image. File replacement uses an expected review version, stores a new R2 object, commits safe metadata and a minimal audit event, then removes the superseded object. Any replacement resets prior checklist and dimension evidence. Three.js and GLB parsing are lazy-loaded only when an authorized model blob is available.

## Generation jobs

Only an owner or admin may request generation for a current, unapproved asset whose private source image and saved rights confirmation belong to the resolved workspace. The API requires an `Idempotency-Key` and an available non-monetary generation credit. It rechecks the R2 source object's size and content type against D1 before any reservation. One D1 batch then moves a unit from available to reserved, inserts the job and entitlement, and appends the reserve, job and audit events before creating a uniquely identified Workflow instance. A guarded query prevents another job while the asset has a queued, running, validating or `awaiting_review` job with a reserved entitlement.

The current provider-neutral adapter supports only zero-cost simulation. It receives stable pseudonymous workspace, job and attempt references, a source MIME/size/SHA-256 descriptor and explicit output limits; it does not receive a raw workspace ID, private object key or permanent URL. A D1 provider-attempt row makes terminal results immutable and distinguishes duplicate, conflicting, late and out-of-order results.

Each Workflow side effect lives inside a named, bounded, retryable step: claim the unchanged input and reserved entitlement, recheck private source existence/size/content type, begin the attempt, create a runtime synthetic GLB, enforce the provider cost-unit cap, validate before storage, privately write the deterministic R2 draft, move the job to validation, read the object back, repeat strict validation and compare its checksum. A missing or drifted source at this second boundary fails before a provider attempt and releases the reservation once. Strict output validation covers GLB/chunk bounds, glTF 2.0 declarations, embedded resources, buffer/accessor ranges, triangle primitives, nested node scale, geometry dimensions, triangle count, texture count and texture bytes. A conditional D1 batch then replaces the draft model metadata, increments the asset review version, resets all approval evidence and marks the job `awaiting_review`. Superseded private output is removed in a separate idempotent cleanup step.

The customer-facing credit remains reserved while the draft awaits a human decision. Approval settles it. Rejection, terminal failure, Workflow-start failure or replacement of the generated draft releases it once. Provider cost units and customer credit units are separate bounded integer ledgers; neither is a price, payment balance or claim that a billable provider ran.

Any source replacement, review-version change, missing rights confirmation, approval, missing entitlement, invalid output, cost-cap breach or disabled kill switch fails closed. Job APIs omit object keys, checksums, raw provider references, deployment data and identities. They expose only the provider-neutral cost-unit result, entitlement state and stable validation code required to review local orchestration. See [Generation pipeline](GENERATION_PIPELINE.md).

## Builds, compatibility and export

Build list reads are bounded to 50 records and never create data. Staff, admin and owner roles may explicitly create or update a draft with at most one active catalogue part from each of nine categories. Updates use an expected record version and a random server-side mutation token so stale D1 batch statements cannot replace a newer selection.

Compatibility is calculated at read time from current, verified structured specifications. Six fixed rules cover CPU socket, memory type, motherboard form factor, GPU clearance, cooler clearance and the recorded GPU power-supply recommendation. Missing selections, unverified specifications or absent required fields produce an `unknown` result rather than an inference.

Portable export is a read-only response and is blocked while any rule is `error` or `unknown`. The JSON contains product identity, verified specifications and bilingual rule evidence only. It omits build and workspace IDs, users, pricing, stock, asset metadata, R2 locations and deployment configuration.

The builder may preview the currently selected component only when its asset is approved. It retrieves the model through the same protected private-file route used by review, creates a page-local object URL and revokes it when the selection changes. The GLB remains visual evidence only and never changes a compatibility result.

## Privacy and observability

Logs contain request method, path, status, duration, request ID and stable error code only. They exclude JWTs, cookies, email addresses, prompts, provider responses and private object locations.

Tracked Wrangler configuration is a non-operational template. Actual deployment coordinates and secrets stay in an ignored local config or Cloudflare's secret store. Wrangler telemetry and dependency instrumentation are disabled.

Payment remains outside the active request path. The generation credit tables are an entitlement state machine only and cannot accept money, create an order or prove payment. The public repository contains a provider-neutral disabled payment interface only; it has no route, UI, binding, payment ledger or credential. See [Payment boundary](PAYMENT_BOUNDARY.md).

## Frontend

The application uses feature-oriented React modules. The public landing route sits outside `SessionProvider`, so it cannot trigger a protected session read. Dashboard, catalogue, review and builder routes mount the session gate before rendering workspace content. The builder route is lazy-loaded so the general shell does not require its code before navigation; Three.js is loaded only when a private GLB is available. Production dashboard, catalogue, review and builder states use protected APIs, while local development uses explicit synthetic fixtures. Semantic controls, visible focus states, responsive layouts and reduced-motion rules are part of the shared design system.
