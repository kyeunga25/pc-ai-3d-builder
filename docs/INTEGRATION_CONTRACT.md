# Integration boundary

The current release has no downstream product integration.

## Isolation requirements

- This Worker, its D1 data, private objects and asynchronous jobs must remain isolated from unrelated services.
- No database, object bucket, provider key, user session or internal identifier may be shared through client code.
- Any approved future integration must use a versioned, minimal payload and an authenticated server-to-server boundary.
- Private objects must be exchanged through an authorized binding or short-lived access mechanism; public object URLs are not allowed.
- The receiving service must not gain direct database access.
- The public repository must use placeholders for every deployment-specific value.
- Browser generation-job payloads remain provider-neutral and exclude object keys, checksums, Workflow IDs and provider references. Provider inputs use only pseudonymous generation/source references, a verified source descriptor and bounded output requirements; internal workspace, user, asset and object identifiers never cross that boundary.
- A future external 3D provider must sit behind a server-side neutral adapter with bounded, idempotent calls, a stable attempt reference and private credentials.
- Capability balances, reservations, provider cost units and attempt records remain internal safety state. They must not be exported, interpreted as payment or used as a downstream customer entitlement.
- A future payment provider must remain outside this public Worker unless a generic, authenticated server boundary and minimal verified event contract receive separate approval.

This document intentionally describes only the public integration boundary.
