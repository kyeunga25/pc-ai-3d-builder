# Generation pipeline

RigStage v1.1 includes a provider-neutral generation-job foundation. The current source also includes a local-development milestone with non-monetary credit accounting, immutable provider-attempt results, strict generated-GLB policy checks and Workers Runtime integration tests. Its only adapter is synthetic and zero monetary cost. The tracked Cloudflare configuration keeps `GENERATION_MODE` set to `disabled`, so a normal production deployment does not call an external provider or create billable work.

## Active boundary

- An owner or admin may request a job only for an unapproved asset whose catalogue part remains active in the verified workspace.
- The canonical private `front` source image must exist with R2 byte-size, content-type and SHA-256 metadata matching D1, or pass a bounded read-back checksum fallback for an older object, and its usage-rights check must already be saved at the current review version. Additional source views are manual-review evidence and never enter this provider boundary.
- The workspace must have one available generation credit. Migration `0009` creates the schema only and grants no production credit.
- `Idempotency-Key` prevents duplicate job creation. The browser keeps at most one pending key in component memory across an ambiguous request result and reuses it only for the same workspace, asset and review version; confirmed responses release it, changed input rotates it, and no key enters a URL or persistent storage. A server replay must retain both the original asset and requested review version; changing either input returns a bilingual conflict before Workflow or credit activity. A new request is blocked while the same asset has an active job or an `awaiting_review` job with a reserved entitlement.
- One D1 batch reserves one unit and commits the queued job, job entitlement, credit event, append-only job event and minimal audit event before the Workflow is triggered. A job-insert trigger rechecks active catalogue state, asset status/version, source checksum and saved rights; a concurrent change aborts and rolls back the complete batch.
- The current adapter creates a small synthetic GLB at runtime. It does not read the source-image bytes, contact an external service or incur provider cost.
- The adapter receives only pseudonymous workspace/job/attempt references, source MIME/size/checksum metadata and a fixed output policy. Raw internal IDs, R2 keys, source bytes and permanent URLs do not cross the provider boundary.
- Workflow steps claim the current input, active catalogue state and reserved entitlement, recheck source existence/size/content type/SHA-256 before any provider attempt, create one stable attempt, enforce the zero monetary and provider cost-unit caps, validate before storage, store the draft under a deterministic private R2 key with R2 checksum enforcement, read it back, repeat validation and compare its checksum.
- D1 stages valid output only while the catalogue part is still active, as a new asset-review version, and resets all prior checklist and dimension evidence in the same batch that marks the job `awaiting_review`. A losing stage race removes the private draft and releases the reservation once.
- The reserved customer credit settles only after human approval. It releases once after rejection, terminal failure, Workflow-start failure or replacement of the generated draft.
- A catalogue part cannot be archived through the application while its job entitlement remains reserved. The generated review therefore stays reachable until approval, rejection or terminal failure resolves the reservation.
- A generated GLB remains a draft. It is unavailable to the Builder until an owner or admin completes the full human checklist and approves it.

Generation credit, provider cost units and money are different concepts:

- `generation_credit_accounts` and job entitlements represent product authorization units only.
- `providerCostUnits` is a bounded abstract result used to test attempt/cap logic; the synthetic adapter reports `1`.
- `maxCostMinor` remains `0`; there is no price, charge, order, invoice, wallet or payment event.

## State model

```text
available credit
      |
      v
reserved + queued -> running -> validating -> awaiting_review
      |                |             |               |
      +----------------+-------------+---------------+
                             |                       |
                         released                human decision
                                                /              \
                                         settled                released
                                         (approve)              (reject)
```

`cancelled` is reserved in the schema for a later explicit termination contract. The current public API does not expose cancellation. Workflow step retries use the same attempt reference; completed steps are durable, matching terminal results are treated as duplicates, and conflicting, late or out-of-order results fail closed.

## Generated GLB policy

The output must be a complete, self-contained glTF 2.0 GLB and satisfy all of the following before it can be staged:

- at most 25 MiB, with exact file/chunk lengths and valid UTF-8 JSON;
- no external URI; embedded binary/data resources only;
- valid buffer, bufferView and accessor byte ranges;
- triangle primitives with valid POSITION bounds and index accessors;
- nested node transform graph without matrix ambiguity, cycles or multiple parents;
- at most 10,000 mm conservative geometry dimension;
- at most 500,000 triangles;
- at most 16 JPEG/PNG/WebP textures and 16 MiB combined texture data;
- identical size and SHA-256 after the private R2 read-back.

Stable validation codes are stored; raw parser/provider errors are not returned to the browser or audit metadata. Every non-null public failure or validation code is limited to 1–128 ASCII uppercase letters, digits or underscores by both the shared response schema and phase-15 D1 insert/update triggers.

## Fail-closed controls

- Any unrecognized mode or non-zero monetary simulation cap resolves to `disabled`.
- Production starts with the kill switch disabled in tracked configuration.
- A missing/resolved entitlement, archived catalogue part, missing or drifted R2 source, source replacement, review-version change, loss of rights confirmation or asset approval invalidates an in-flight job. A catalogue archive before claim records `GENERATION_INPUT_STALE` without a provider attempt; an archive before staging removes the late draft. A source failure after reservation records `GENERATION_INPUT_MISSING`, creates no provider attempt and releases the credit once.
- Compensation removes only one exact private R2 key, retries one transient delete failure and then stops without reversing committed D1 state; a persistent failure can leave an inactive private orphan and is not claimed as guaranteed deletion.
- Dimension, triangle, texture, byte-range, self-containment, length or checksum failure rejects the output before approval.
- Workflow and API responses expose no R2 key, checksum, provider reference, user identity or deployment coordinate.
- Failure records use stable codes. Raw provider and platform errors are not returned or added to audit metadata.
- No Cron trigger is configured; jobs start only from an authorized, explicit request.

## Local verification

The browser-only flow is available through `npm run local:ai:start`: create the built-in synthetic PNG in asset review, save explicit rights confirmation, generate the runtime GLB, complete human review and continue to Builder. This keeps all files in the current browser session.

`npm run test:worker` runs the real migrations and Workflow locally under workerd/Miniflare with isolated D1 and R2 bindings. It rejects missing, metadata-drifted or same-metadata checksum-drifted source storage before reservation, forces post-preflight source and catalogue-archive races, verifies full reservation rollback, late-draft cleanup and exact-once release, forces one transient output-validation retry, proves a single successful provider attempt/reservation, verifies stored R2 SHA-256 metadata, reads and validates the private output, checks idempotent request replay, settles on approval, releases terminal failure once and runs `PRAGMA foreign_key_check`.

`npm run local:ai:debug` applies migrations to Wrangler's local D1 and starts `wrangler dev --local` with simulation variables. It does not bypass Access authentication and never selects remote bindings.

## External-provider gate

The synthetic adapter is not evidence that external 3D generation is production-ready. A real adapter requires a separate approval and must add, at minimum:

1. reviewed input/output rights, retention, deletion, security and service terms;
2. an explicit, pre-authorized per-job monetary cap plus separately reviewed customer entitlement reservation/settlement rules;
3. signed and replay-protected callback or bounded polling behavior;
4. provider-neutral server interfaces with secrets outside Git and the browser;
5. success, failure, timeout, duplicate, out-of-order, callback-signature and kill-switch tests;
6. a capped non-production run using authorized synthetic material;
7. another production review before activation.

Provider-specific identifiers, routing, quality targets and commercial terms must remain outside the public domain model, UI and export. The current pseudonymous descriptor interface is not an authorization to add source delivery, provider credentials or network egress.
