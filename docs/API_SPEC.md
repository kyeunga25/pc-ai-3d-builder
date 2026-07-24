# API specification

All responses include public security headers. API responses use `Cache-Control: no-store`.

## `GET /api/health`

Public lightweight health check.

```json
{
  "status": "ok",
  "service": "app",
  "requestId": "generated-per-request"
}
```

No dependency, account, database or resource identifier is returned.

## `GET /api/session`

Requires a valid Cloudflare Access assertion, an invited active user and at least one active workspace membership. It returns the current user display data, selected workspace and allowed workspace summaries.

The request may include `X-RigStage-Workspace-Id`. The Worker treats it only as a request and accepts it only when D1 confirms active membership. Session reads do not write audit records.

## `GET /api/workspaces`

Uses the same authentication and workspace resolution path and returns only the caller's active workspace summaries.

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

Expected codes include `ACCESS_TOKEN_REQUIRED`, `ACCESS_TOKEN_INVALID`, `INVITE_REQUIRED`, `WORKSPACE_FORBIDDEN`, `IDENTITY_BINDING_CONFLICT`, `RATE_LIMITED`, `NOT_FOUND` and `INTERNAL_ERROR`.

A 429 response includes `Retry-After: 60`. Unexpected internal errors never expose raw exception messages.
