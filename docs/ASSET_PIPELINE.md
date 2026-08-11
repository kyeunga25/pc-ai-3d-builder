# Asset handling boundary

The current public release accepts one private static source image and one self-contained GLB per visual-asset record. Production validates the declared MIME type, binary signature, encoded size and effective browser resource budget before storing an opaque R2 object key in workspace-scoped D1 metadata. Source images are limited to 8,192 px per edge and 24 MP; APNG and animated WebP are rejected. Manual and generated GLBs share strict buffer, accessor, node-graph, dimension, triangle and texture limits. Authorized reads stream the object through the Worker without exposing its key, checksum or a permanent URL.

The browser creates short-lived blob URLs for the current page and lazy-loads Three.js only when a GLB is available. Camera presets, fit-to-view, shaded, wireframe and static controls support manual visual inspection. After approval, the builder may retrieve the currently selected component through the same protected route; changing the selection revokes the previous object URL. A GLB remains a draft until an owner or admin completes every checklist item and supplies human-verified dimensions.

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

The v1.1 Workflow can ingest only a runtime synthetic, zero-cost GLB when simulation is explicitly enabled. The local-development milestone applies the same shared GLB safety policy used by manual uploads before private storage and again after read-back, increments the review version and resets prior evidence. It also reserves one non-monetary capability unit and records one immutable provider attempt. Tracked production configuration remains disabled, so this path is orchestration evidence rather than an external 3D-generation capability.

External provider generation, paid retries and provider callbacks remain inactive. No provider choice, commercial routing rule or private quality target is recorded in this repository. See [Generation pipeline](GENERATION_PIPELINE.md).
