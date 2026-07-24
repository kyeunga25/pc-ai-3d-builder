# Asset handling boundary

The current public release does not upload product images, call a 3D provider, download models or expose private R2 objects. The review screen uses synthetic records only.

Any implementation that activates this boundary must preserve these rules:

- Confirm the caller's active workspace before creating or reading an object.
- Keep originals, generated models and render outputs private.
- Validate declared content type, file signature and bounded size.
- Store provenance and a checksum without logging private object locations.
- Keep provider keys and provider responses on the server.
- Treat generated geometry as a draft until explicit human approval.
- Never infer compatibility or verified product identity from a generated mesh.
- Make long-running work asynchronous and idempotent.
- Provide explicit failure and retry states without automatically duplicating paid work.

No provider choice, commercial routing rule or private quality target is recorded in this repository.
