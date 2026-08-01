# Integration boundary

The current release has no downstream product integration.

## Isolation requirements

- This Worker, its D1 data, private objects and asynchronous jobs must remain isolated from unrelated services.
- No database, object bucket, provider key, user session or internal identifier may be shared through client code.
- Any approved future integration must use a versioned, minimal payload and an authenticated server-to-server boundary.
- Private objects must be exchanged through an authorized binding or short-lived access mechanism; public object URLs are not allowed.
- The receiving service must not gain direct database access.
- The public repository must use placeholders for every deployment-specific value.
- Generation-job payloads use internal workspace and asset references only; provider references must not enter the browser, portable export or downstream product payloads.
- A future external 3D provider must sit behind a server-side neutral adapter with bounded, idempotent calls and private credentials.
- A future payment provider must remain outside this public Worker unless a generic, authenticated server boundary and minimal verified event contract receive separate approval.

This document intentionally describes only the public integration boundary.
