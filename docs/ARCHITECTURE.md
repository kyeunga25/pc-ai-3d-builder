# Architecture

## Request path

```text
Browser
  -> Cloudflare Access
  -> Worker
     -> public health route
     -> verified Access identity
     -> subject-keyed rate limit
     -> D1 invited user and active memberships
     -> workspace-scoped API response
  -> Static Assets binding
```

The Worker handles `/api/*` before falling back to the built Vite application. Static Assets use single-page-application fallback.

## Authentication and tenancy

The Worker validates the Access assertion against the configured issuer and audience. It then resolves the active D1 user by bound subject or, for the first login only, by a verified invited email. Subject binding uses a conditional update and verifies the persisted winner before returning a context.

A requested workspace header never grants access by itself. The selected workspace must be present in the caller's active membership set.

## Storage bindings

D1 stores identity, workspace metadata, workspace-scoped catalogue records, current asset review state and append-only review events. Asset mutations use an expected review version and write the asset transition, review event and audit event through one D1 batch.

The R2 binding is private and has no public object-serving route in this release. The Workflow binding exports a placeholder class but no HTTP route starts it and it performs no external generation work.

## Catalogue and asset review

Catalogue reads are bounded to 100 rows per request and use an ID cursor. The client-provided workspace header never becomes a database scope directly; the verified request context supplies the workspace predicate.

The review queue returns only draft or in-review assets in the active workspace. Viewer roles are read-only, staff may save drafts, and owner or admin roles may approve or reject. Approval requires the complete fixed checklist and three positive, bounded dimensions. Visual geometry remains non-authoritative for compatibility.

## Privacy and observability

Logs contain request method, path, status, duration, request ID and stable error code only. They exclude JWTs, cookies, email addresses, prompts, provider responses and private object locations.

Tracked Wrangler configuration is a non-operational template. Actual deployment coordinates and secrets stay in an ignored local config or Cloudflare's secret store. Wrangler telemetry and dependency instrumentation are disabled.

## Frontend

The application uses feature-oriented React modules. The builder route is lazy-loaded so the general shell does not require its code before navigation. Semantic controls, visible focus states, responsive layouts and reduced-motion rules are part of the shared design system.
