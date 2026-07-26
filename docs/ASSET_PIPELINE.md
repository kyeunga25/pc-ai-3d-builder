# Asset handling boundary

The current public release accepts one private source image and one self-contained GLB per visual-asset record. Production validates the declared MIME type, binary signature and bounded size before storing an opaque R2 object key in workspace-scoped D1 metadata. Authorized reads stream the object through the Worker without exposing its key, checksum or a permanent URL.

The browser creates short-lived blob URLs for the current page and lazy-loads Three.js only when a GLB is available. Camera presets and orbit controls support manual visual inspection. A GLB remains a draft until an owner or admin completes every checklist item and supplies human-verified dimensions.

Review mutations use a fixed checklist, bounded human-verified dimensions, role checks and an expected version. Asset state, review history and the minimal audit event are committed together. Approval remains a visual-asset decision only and never establishes compatibility.

The active upload and review boundary preserves these rules:

- Confirm the caller's active workspace before creating or reading an object.
- Keep originals, generated models and render outputs private.
- Validate declared content type, file signature and bounded size.
- Store provenance and a checksum without logging private object locations.
- Keep provider keys and provider responses on the server.
- Treat generated geometry as a draft until explicit human approval.
- Never infer compatibility or verified product identity from a generated mesh.
- Make long-running work asynchronous and idempotent.
- Provide explicit failure and retry states without automatically duplicating paid work.

External provider generation, paid retries and generated-output ingestion remain inactive. No provider choice, commercial routing rule or private quality target is recorded in this repository.
