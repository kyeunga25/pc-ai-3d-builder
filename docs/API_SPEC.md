# API specification

All responses include public security headers. API responses use `Cache-Control: no-store`.

JSON mutation routes require the exact `application/json` media-type token and CSV import requires the exact `text/csv` token; media-type matching is case-insensitive and permits parameters such as `charset=utf-8`. Prefix lookalikes such as `application/jsonp` or `text/csvx` return bilingual `UNSUPPORTED_MEDIA_TYPE` before the Worker reads the body or performs a D1/R2 write. Correcting the header permits a safe retry under the route's existing role, workspace, version and idempotency rules.

## `GET /api/health`

Public lightweight health check.

```json
{
  "status": "ok",
  "service": "rigstage",
  "requestId": "generated-per-request"
}
```

No dependency, account, database or resource identifier is returned.

## `GET /api/session`

Requires a valid Cloudflare Access assertion, an invited active user and at least one active workspace membership. It returns the current user display data, selected workspace and allowed workspace summaries.

The request may include `X-RigStage-Workspace-Id`. The Worker treats it only as a request and accepts it only when D1 confirms active membership. First-login subject binding rechecks the active user, selected workspace and membership in the conditional D1 update; a concurrent revocation returns bilingual `INVITE_REQUIRED` without binding the subject, while a concurrent different-subject winner returns `IDENTITY_BINDING_CONFLICT`. Persisting a workspace switch uses the same active membership guard and returns `WORKSPACE_FORBIDDEN` without changing the previous selection if access was revoked. These failures can be retried after an authorized reactivation. Session reads do not write audit records.

Browser API requests send `X-Requested-With: XMLHttpRequest`. An expired Access application session therefore returns `401`; the UI performs a top-level navigation to re-enter the Access login flow rather than adding an application bypass.

## `GET /api/workspaces`

Uses the same authentication and workspace resolution path and returns only the caller's active workspace summaries.

## `GET /api/dashboard`

Returns read-only counts for the resolved workspace: active and verified catalogue records, approved and pending visual assets, draft builds, and compatibility readiness across the latest 50 drafts. Recent work combines at most six asset-review or build items. The route performs no writes, appends no audit event and returns no user identity.

## `GET /api/catalogue`

Returns active catalogue parts from the resolved workspace. `limit` defaults to 50 and is bounded to 100. `cursor` is the last returned record ID; `category` accepts only a known component category. Each record includes structured specifications, their verification status and a non-negative record version. The response contains `items` and a nullable `nextCursor`.

## `POST /api/catalogue`

Creates one active catalogue part in the resolved workspace. Viewer roles cannot mutate. The JSON body is limited to 32 KiB and must contain a valid SKU, category, manufacturer, model, HKD price in minor units, consistent stock status and count, structured specifications and their verification status. SKU values are unique within a workspace.

The catalogue row and a minimal audit event are submitted in one D1 batch. The response is the created record with version `0`.

## `POST /api/catalogue/import`

Imports a CSV document using the exact `Content-Type: text/csv` media-type token, with optional parameters. The body is limited to 256 KiB and must contain the exact documented template headers and between 1 and 50 valid rows. Duplicate SKU values within the document or the resolved workspace reject the complete import.

Every catalogue insert and its minimal audit event are submitted in one transactional D1 batch. The route never partially imports a rejected document.

## `PATCH /api/catalogue/:partId`

Updates or archives one active catalogue part in the resolved workspace. Viewer roles cannot mutate. Both actions require `expectedVersion`; a stale value fails without overwriting the newer record. Updates accept the same bounded catalogue fields as creation. A category cannot change while the part is referenced by an existing build; this returns bilingual `CATALOGUE_CATEGORY_LOCKED` without changing the part, selection or audit history. Archive is a logical state transition and returns no body. A part with any reserved generation entitlement returns bilingual `CATALOGUE_GENERATION_LOCKED`, remains active and writes no archive audit. The user can retry with the same catalogue version after the Workflow fails or after an owner/admin approves or rejects the generated draft and settles or releases the reservation.

The conditional catalogue update and minimal audit event are submitted in one D1 batch. The update rechecks the reserved-entitlement condition at its D1 write boundary. A database trigger independently prevents an `awaiting_review` generated draft with reserved credit from being hidden by another catalogue status update.

## `GET /api/builds`

Returns at most 50 active draft summaries from the resolved workspace, ordered by the latest update. A read never creates a build or appends an audit event.

## `POST /api/builds`

Explicitly creates one workspace-scoped draft. Viewer roles cannot mutate. The bounded JSON body contains a name and at most nine unique active catalogue part IDs, with no more than one part per component category. The build, selections and minimal audit event are submitted in one D1 batch. A database trigger rechecks that every selected part remains active at insertion time; an archive race returns `BUILD_SELECTION_INVALID` and rolls back the complete batch.

## `GET /api/builds/:buildId`

Returns one draft with its selected catalogue records, current total price, deterministic compatibility findings, summary counts and non-negative version. The response never exposes the server mutation token.

## `PATCH /api/builds/:buildId`

Updates the name and complete selected-part set, or logically archives the draft. Viewer roles cannot mutate. Both actions require `expectedVersion`. Update statements use a new server-only mutation token to gate deletion, replacement selections and the minimal audit event in one D1 batch. A stale version cannot replace a newer selection, and a part archived after selection validation aborts the batch without removing the previous selection.

## `GET /api/builds/:buildId/export`

Returns a portable JSON attachment only when every fixed compatibility rule has neither an `error` nor an `unknown` result. Warnings remain visible. The response omits users, workspace and internal build IDs, price, stock, asset metadata, object keys, checksums and deployment data.

## `GET /api/assets/review-queue`

Returns at most 50 draft or in-review assets from the resolved workspace, with their catalogue identity, fixed checklist identifiers, source-rights flag, human-verified dimensions, review version and safe file metadata. It never returns private object keys, checksums or provider responses.

## `GET /api/assets/:assetId`

Returns one active catalogue asset from the resolved workspace, including approved records. The response uses the same safe representation as the review queue.

## `POST /api/catalogue/:partId/assets/source`

Creates a new draft asset for an active catalogue part and uploads its first private source image. Viewer roles cannot mutate. The binary body must be JPEG, PNG or WebP, match its declared MIME type and be at most 10 MiB. Before any R2 or D1 write, container-level validation requires bounded positive dimensions of at most 32,768 px per edge and 100 MP total, plus a complete PNG chunk sequence with valid CRCs, a bounded JPEG marker/frame/scan sequence ending at EOI, or an exact WebP RIFF sequence containing bounded still or animation-frame bitstream chunks with parseable headers. Animated WebP is additionally limited to 120 frames and 100 MP aggregate frame area. A signature-only, truncated, checksum-corrupted, dimension-unsafe, animation-unsafe or MIME-mismatched body returns bilingual `VALIDATION_ERROR`. This boundary validates container structure, not image provenance, visual meaning or fully decoded pixels.

The validated object is stored under an opaque private R2 key, with its computed SHA-256 supplied to R2 so the upload itself is integrity-checked. The workspace-scoped asset row and minimal audit event are committed in one D1 batch. A D1 trigger rechecks that the catalogue part is still active at insert time; if it was archived after the initial lookup, the whole batch rolls back, the new R2 object is removed and bilingual `CATALOGUE_PART_NOT_FOUND` is returned. A retry is safe after an authorized user restores the part, while the one-asset-per-part constraint rejects a successful replay. The response never contains the object key or checksum.

## `PUT /api/assets/:assetId/files/:kind`

Replaces `source` or `model` for a non-approved asset. Viewer roles cannot mutate. The `X-RigStage-Expected-Version` header is required. Source files use the same image rules as creation. Models must be a complete, self-contained glTF 2.0 GLB with a matching binary header and declared length, at most 25 MiB. External resource URIs are rejected before storage.

A successful replacement increments the review version and resets the checklist, dimensions and approval state. The new R2 object is stored with its SHA-256 integrity check before the conditional D1 batch. A database trigger rechecks that the linked catalogue part is still active at this write boundary. If an archive wins the race, the whole D1 batch rolls back, the new object is removed, the previous object remains and workspace-safe `ASSET_NOT_FOUND` is returned. Reactivating the part permits a retry with the unchanged asset version. After a committed transition, the previous private object is removed separately.

## `GET /api/assets/:assetId/files/:kind`

Streams a private `source` or `model` file only after Access verification and active workspace membership resolution. Before streaming, the R2 object's byte size, content type and SHA-256 must still match the validated D1 metadata. New objects use R2's stored SHA-256 metadata for the streaming path; an older object without that metadata receives a bounded read-back, file validation and digest comparison before any bytes are returned. A missing, invalid or mismatched object returns bilingual `ASSET_FILE_NOT_FOUND` without writing state; an R2 or cryptographic operational failure remains an internal failure and can be retried. A successful response is `private, no-store` with a generic filename. Permanent object URLs and keys are never returned.

## `PATCH /api/assets/:assetId/review`

Accepts a JSON body of at most 32 KiB with `action`, `expectedVersion`, `completedChecks` and `dimensionsMm`. Viewer roles cannot mutate. Staff may save drafts; owner or admin roles may also approve or reject. Approval requires every fixed checklist item, three positive dimensions of at most 10,000 mm and a private GLB whose R2 object still exists with the recorded byte size and `model/gltf-binary` metadata. Before committing approval, the Worker bounds the object to 25 MiB, reads it back, repeats the GLB structure and self-containment validation, and compares its SHA-256 with D1. Missing, invalid or same-metadata checksum-drifted storage returns bilingual `ASSET_MODEL_REQUIRED` without a review or audit write; restoring the exact validated object permits a retry at the same asset version. An R2 read or cryptographic operational failure remains an internal failure and can be retried.

The conditional asset update, review event and audit event are submitted in one D1 batch. A database trigger requires the linked catalogue part to remain active when the asset update executes. If a concurrent archive commits first, the review, audit and any generation-credit transition all roll back, workspace-safe `ASSET_NOT_FOUND` is returned and the original asset version can be retried after reactivation. A stale `expectedVersion` fails without overwriting the newer record.

## `GET /api/assets/:assetId/generation-jobs`

Returns the active generation capability and at most 20 recent jobs for one asset in the resolved workspace. Viewer roles may read status. Capability includes the mode, zero monetary cap and the workspace's non-monetary available/reserved/settled/released generation units. Each public job contains only its ID, asset ID, provider-neutral simulation kind, stable status, output-ready flag, stable failure code, entitlement status, bounded provider cost units, stable validation code and timestamps.

The response never contains the requester, idempotency key, Workflow instance ID, monetary/provider-specific cost data, input or output checksum, R2 key, provider reference or raw error. Provider cost units are abstract test accounting, not currency or a provider invoice. A disabled capability is a valid `200` response and accurately represents the tracked production default.

```json
{
  "capability": {
    "mode": "simulation",
    "maxCostMinor": 0,
    "credits": {
      "availableUnits": 1,
      "reservedUnits": 1,
      "settledUnits": 0,
      "releasedUnits": 0
    }
  },
  "items": [
    {
      "id": "generation_synthetic_example",
      "assetId": "asset_synthetic_example",
      "status": "awaiting_review",
      "kind": "simulation",
      "outputReady": true,
      "failureCode": null,
      "entitlementStatus": "reserved",
      "providerCostUnits": 1,
      "validationCode": "GLB_VALID",
      "createdAt": "synthetic-timestamp",
      "updatedAt": "synthetic-timestamp"
    }
  ]
}
```

## `POST /api/assets/:assetId/generation-jobs`

Creates a zero-monetary-cost simulation job only when the runtime capability is explicitly set to simulation. The route is restricted to owner or admin roles and requires a valid `Idempotency-Key`, an unapproved asset, its current `expectedVersion`, a stored private source image, a previously saved source-rights confirmation and at least one available non-monetary generation credit. Before reserving credit, the route requires the source R2 object to match the D1-recorded byte size, content type and SHA-256; objects without stored R2 SHA-256 metadata use a bounded read-back. Missing or drifted storage returns bilingual `GENERATION_SOURCE_REQUIRED` without creating a job, credit event, audit event or Workflow; an R2 or cryptographic operational failure remains an internal failure and can be retried.

One D1 batch moves a credit from available to reserved and inserts the queued job, entitlement, reserve event, initial job event and minimal audit record before the uniquely identified Workflow instance is created. A D1 trigger rechecks that the catalogue part is active and the asset version, source checksum, rights confirmation and unapproved status still match at job insertion. If a catalogue archive or asset change wins after route preflight, the batch rolls back completely and bilingual `ASSET_VERSION_CONFLICT` is returned without consuming the idempotency key; an authorized reactivation can retry safely with the same key. Reusing an idempotency key for the same successfully created asset job returns the original job without another reservation or Workflow; reusing it for another asset is rejected. Another job is blocked while the asset has a queued, running, validating or awaiting-human-review job with a reserved entitlement.

Successful creation returns `202`. The Workflow rechecks the active catalogue state at claim and the same private source size, content type and SHA-256 before beginning a provider attempt, closing races after route preflight. A catalogue archive before claim records `GENERATION_INPUT_STALE`, releases once and makes no provider attempt. The final staging update rechecks active catalogue state at the D1 write boundary; if a later archive wins, the private draft is removed and the reservation is released once instead of creating an invisible review draft. If the source disappears or drifts, stable failure code `GENERATION_INPUT_MISSING` releases the reservation once without a provider attempt; replaying the original idempotency key returns that terminal job. The Workflow output remains a draft and resets all prior checklist and dimension evidence before its state becomes `awaiting_review`. Approval settles the reservation. Rejection, terminal failure, Workflow-start failure or generated-draft replacement releases it once. Tracked production configuration returns `GENERATION_DISABLED` before any database write or external activity. An absent/empty credit account returns `GENERATION_CREDITS_REQUIRED` without creating a job or provider attempt.

## Errors

```json
{
  "error": {
    "code": "STABLE_CODE",
    "message": "繁體中文訊息",
    "requestId": "generated-per-request"
  }
}
```

Expected codes include `ACCESS_TOKEN_REQUIRED`, `ACCESS_TOKEN_INVALID`, `INVITE_REQUIRED`, `WORKSPACE_FORBIDDEN`, `IDENTITY_BINDING_CONFLICT`, `ROLE_FORBIDDEN`, `VALIDATION_ERROR`, `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`, `CATALOGUE_PART_NOT_FOUND`, `CATALOGUE_SKU_CONFLICT`, `CATALOGUE_VERSION_CONFLICT`, `CATALOGUE_CATEGORY_LOCKED`, `CATALOGUE_GENERATION_LOCKED`, `BUILD_NOT_FOUND`, `BUILD_SELECTION_INVALID`, `BUILD_VERSION_CONFLICT`, `BUILD_EXPORT_BLOCKED`, `ASSET_NOT_FOUND`, `ASSET_FILE_NOT_FOUND`, `ASSET_ALREADY_EXISTS`, `ASSET_LOCKED`, `ASSET_MODEL_REQUIRED`, `ASSET_APPROVAL_INCOMPLETE`, `ASSET_VERSION_CONFLICT`, `GENERATION_DISABLED`, `GENERATION_ALREADY_ACTIVE`, `GENERATION_CREDITS_REQUIRED`, `GENERATION_SOURCE_REQUIRED`, `GENERATION_RIGHTS_REQUIRED`, `GENERATION_START_FAILED`, `IDEMPOTENCY_KEY_REUSED`, `RATE_LIMITED`, `NOT_FOUND` and `INTERNAL_ERROR`.

A 429 response includes `Retry-After: 60`. Unexpected internal errors never expose raw exception messages.
