# API specification

All responses include public security headers. API responses use `Cache-Control: no-store`.

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

The request may include `X-RigStage-Workspace-Id`. The Worker treats it only as a request and accepts it only when D1 confirms active membership. Session reads do not write audit records.

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

Imports a CSV document using `Content-Type: text/csv`. The body is limited to 256 KiB and must contain the exact documented template headers and between 1 and 50 valid rows. Duplicate SKU values within the document or the resolved workspace reject the complete import.

Every catalogue insert and its minimal audit event are submitted in one transactional D1 batch. The route never partially imports a rejected document.

## `PATCH /api/catalogue/:partId`

Updates or archives one active catalogue part in the resolved workspace. Viewer roles cannot mutate. Both actions require `expectedVersion`; a stale value fails without overwriting the newer record. Updates accept the same bounded catalogue fields as creation. Archive is a logical state transition and returns no body.

The conditional catalogue update and minimal audit event are submitted in one D1 batch.

## `GET /api/builds`

Returns at most 50 active draft summaries from the resolved workspace, ordered by the latest update. A read never creates a build or appends an audit event.

## `POST /api/builds`

Explicitly creates one workspace-scoped draft. Viewer roles cannot mutate. The bounded JSON body contains a name and at most nine unique active catalogue part IDs, with no more than one part per component category. The build, selections and minimal audit event are submitted in one D1 batch.

## `GET /api/builds/:buildId`

Returns one draft with its selected catalogue records, current total price, deterministic compatibility findings, summary counts and non-negative version. The response never exposes the server mutation token.

## `PATCH /api/builds/:buildId`

Updates the name and complete selected-part set, or logically archives the draft. Viewer roles cannot mutate. Both actions require `expectedVersion`. Update statements use a new server-only mutation token to gate deletion, replacement selections and the minimal audit event in one D1 batch. A stale version cannot replace a newer selection.

## `GET /api/builds/:buildId/export`

Returns a portable JSON attachment only when every fixed compatibility rule has neither an `error` nor an `unknown` result. Warnings remain visible. The response omits users, workspace and internal build IDs, price, stock, asset metadata, object keys, checksums and deployment data.

## `GET /api/assets/review-queue`

Returns at most 50 draft or in-review assets from the resolved workspace, with their catalogue identity, fixed checklist identifiers, source-rights flag, human-verified dimensions, review version and safe file metadata. It never returns private object keys, checksums or provider responses.

## `GET /api/assets/:assetId`

Returns one active catalogue asset from the resolved workspace, including approved records. The response uses the same safe representation as the review queue.

## `POST /api/catalogue/:partId/assets/source`

Creates a new draft asset for an active catalogue part and uploads its first private source image. Viewer roles cannot mutate. The binary body must be JPEG, PNG or WebP, match its declared MIME type and be at most 10 MiB. A file signature mismatch rejects the request before D1 metadata is committed.

The validated object is stored under an opaque private R2 key. The workspace-scoped asset row and minimal audit event are committed in one D1 batch. The response never contains the object key or checksum.

## `PUT /api/assets/:assetId/files/:kind`

Replaces `source` or `model` for a non-approved asset. Viewer roles cannot mutate. The `X-RigStage-Expected-Version` header is required. Source files use the same image rules as creation. Models must be a complete, self-contained glTF 2.0 GLB with a matching binary header and declared length, at most 25 MiB. External resource URIs are rejected before storage.

A successful replacement increments the review version and resets the checklist, dimensions and approval state. The new R2 object is stored before the conditional D1 batch; a failed D1 transition removes only that new object. After a committed transition, the previous private object is removed separately.

## `GET /api/assets/:assetId/files/:kind`

Streams a private `source` or `model` file only after Access verification and active workspace membership resolution. The response is `private, no-store` with a generic filename. Permanent object URLs and keys are never returned.

## `PATCH /api/assets/:assetId/review`

Accepts a JSON body of at most 32 KiB with `action`, `expectedVersion`, `completedChecks` and `dimensionsMm`. Viewer roles cannot mutate. Staff may save drafts; owner or admin roles may also approve or reject. Approval requires a stored GLB, every fixed checklist item and three positive dimensions of at most 10,000 mm.

The conditional asset update, review event and audit event are submitted in one D1 batch. A stale `expectedVersion` fails without overwriting the newer record.

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

Creates a zero-monetary-cost simulation job only when the runtime capability is explicitly set to simulation. The route is restricted to owner or admin roles and requires a valid `Idempotency-Key`, an unapproved asset, its current `expectedVersion`, a stored private source image, a previously saved source-rights confirmation and at least one available non-monetary generation credit.

One D1 batch moves a credit from available to reserved and inserts the queued job, entitlement, reserve event, initial job event and minimal audit record before the uniquely identified Workflow instance is created. Reusing an idempotency key for the same asset returns the original job without another reservation or Workflow; reusing it for another asset is rejected. Another job is blocked while the asset has a queued, running, validating or awaiting-human-review job with a reserved entitlement.

Successful creation returns `202`. The Workflow output remains a draft and resets all prior checklist and dimension evidence before its state becomes `awaiting_review`. Approval settles the reservation. Rejection, terminal failure, Workflow-start failure or generated-draft replacement releases it once. Tracked production configuration returns `GENERATION_DISABLED` before any database write or external activity. An absent/empty credit account returns `GENERATION_CREDITS_REQUIRED` without creating a job or provider attempt.

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

Expected codes include `ACCESS_TOKEN_REQUIRED`, `ACCESS_TOKEN_INVALID`, `INVITE_REQUIRED`, `WORKSPACE_FORBIDDEN`, `IDENTITY_BINDING_CONFLICT`, `ROLE_FORBIDDEN`, `VALIDATION_ERROR`, `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`, `CATALOGUE_PART_NOT_FOUND`, `CATALOGUE_SKU_CONFLICT`, `CATALOGUE_VERSION_CONFLICT`, `BUILD_NOT_FOUND`, `BUILD_SELECTION_INVALID`, `BUILD_VERSION_CONFLICT`, `BUILD_EXPORT_BLOCKED`, `ASSET_NOT_FOUND`, `ASSET_FILE_NOT_FOUND`, `ASSET_ALREADY_EXISTS`, `ASSET_LOCKED`, `ASSET_MODEL_REQUIRED`, `ASSET_APPROVAL_INCOMPLETE`, `ASSET_VERSION_CONFLICT`, `GENERATION_DISABLED`, `GENERATION_ALREADY_ACTIVE`, `GENERATION_CREDITS_REQUIRED`, `GENERATION_SOURCE_REQUIRED`, `GENERATION_RIGHTS_REQUIRED`, `GENERATION_START_FAILED`, `IDEMPOTENCY_KEY_REUSED`, `RATE_LIMITED`, `NOT_FOUND` and `INTERNAL_ERROR`.

A 429 response includes `Retry-After: 60`. Unexpected internal errors never expose raw exception messages.
