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

Expected codes include `ACCESS_TOKEN_REQUIRED`, `ACCESS_TOKEN_INVALID`, `INVITE_REQUIRED`, `WORKSPACE_FORBIDDEN`, `IDENTITY_BINDING_CONFLICT`, `ROLE_FORBIDDEN`, `VALIDATION_ERROR`, `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`, `CATALOGUE_PART_NOT_FOUND`, `CATALOGUE_SKU_CONFLICT`, `CATALOGUE_VERSION_CONFLICT`, `ASSET_NOT_FOUND`, `ASSET_FILE_NOT_FOUND`, `ASSET_ALREADY_EXISTS`, `ASSET_LOCKED`, `ASSET_MODEL_REQUIRED`, `ASSET_APPROVAL_INCOMPLETE`, `ASSET_VERSION_CONFLICT`, `RATE_LIMITED`, `NOT_FOUND` and `INTERNAL_ERROR`.

A 429 response includes `Retry-After: 60`. Unexpected internal errors never expose raw exception messages.
