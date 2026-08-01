# Generation pipeline

RigStage v1.1 includes a provider-neutral generation-job foundation and a zero-cost synthetic adapter for local, test and explicitly controlled non-production validation. The tracked Cloudflare configuration keeps `GENERATION_MODE` set to `disabled`, so a normal production deployment does not call an external provider or create billable work.

## Active boundary

- An owner or admin may request a job only for an unapproved asset in the verified workspace.
- The private source image must exist and its usage-rights check must already be saved at the current review version.
- `Idempotency-Key` prevents duplicate job creation, while a partial unique index permits only one queued, running or validating job per asset.
- The request commits the queued job, append-only job event and minimal audit event before the Workflow is triggered.
- The current adapter creates a small synthetic GLB at runtime. It does not read the source-image bytes, contact an external service or incur provider cost.
- Workflow steps claim the current input, enforce the zero-cost cap, store the draft under a deterministic private R2 key, read it back, validate the complete GLB and compare its checksum.
- D1 stages valid output as a new asset-review version and resets all prior checklist and dimension evidence in the same batch that marks the job `awaiting_review`.
- A generated GLB remains a draft. It is unavailable to the Builder until an owner or admin completes the full human checklist and approves it.

## State model

```text
queued -> running -> validating -> awaiting_review
   |         |           |
   +---------+-----------+-> failed
```

`cancelled` is reserved in the schema for a later explicit termination contract. The current public API does not expose cancellation or retry because no paid provider is active.

## Fail-closed controls

- Any unrecognized mode or non-zero simulation cost configuration resolves to `disabled`.
- Production starts with the kill switch disabled in tracked configuration.
- Source replacement, review-version changes, loss of rights confirmation or asset approval invalidate an in-flight job.
- Output above the 25 MiB model limit, a malformed glTF header, external URI, length mismatch or checksum mismatch fails the job.
- Workflow and API responses expose no R2 key, checksum, provider reference, user identity or deployment coordinate.
- Failure records use stable codes. Raw provider and platform errors are not returned or added to audit metadata.
- No Cron trigger is configured; jobs start only from an authorized, explicit request.

## External-provider gate

The synthetic adapter is not evidence that external 3D generation is production-ready. A real adapter requires a separate approval and must add, at minimum:

1. reviewed input/output rights, retention, deletion, security and service terms;
2. an explicit per-job cost cap, reservation and settlement rule;
3. signed and replay-protected callback or bounded polling behavior;
4. provider-neutral server interfaces with secrets outside Git and the browser;
5. success, failure, timeout, duplicate, out-of-order and kill-switch tests;
6. a capped non-production run using authorized synthetic material;
7. another production review before activation.

Provider-specific identifiers, routing, quality targets and commercial terms must remain outside the public domain model, UI and export.
