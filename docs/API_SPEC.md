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

Returns at most 50 draft or in-review assets from the resolved workspace, with their catalogue identity, fixed checklist identifiers, source-rights flag, human-verified dimensions and review version. It never returns private object keys or provider responses.

## `PATCH /api/assets/:assetId/review`

Accepts a JSON body of at most 32 KiB with `action`, `expectedVersion`, `completedChecks` and `dimensionsMm`. Viewer roles cannot mutate. Staff may save drafts; owner or admin roles may also approve or reject. Approval requires every fixed checklist item and three positive dimensions of at most 10,000 mm.

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

Expected codes include `ACCESS_TOKEN_REQUIRED`, `ACCESS_TOKEN_INVALID`, `INVITE_REQUIRED`, `WORKSPACE_FORBIDDEN`, `IDENTITY_BINDING_CONFLICT`, `ROLE_FORBIDDEN`, `VALIDATION_ERROR`, `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`, `CATALOGUE_PART_NOT_FOUND`, `CATALOGUE_SKU_CONFLICT`, `CATALOGUE_VERSION_CONFLICT`, `ASSET_NOT_FOUND`, `ASSET_APPROVAL_INCOMPLETE`, `ASSET_VERSION_CONFLICT`, `RATE_LIMITED`, `NOT_FOUND` and `INTERNAL_ERROR`.

A 429 response includes `Retry-After: 60`. Unexpected internal errors never expose raw exception messages.
