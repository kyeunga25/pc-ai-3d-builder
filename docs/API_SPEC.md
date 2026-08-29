# API specification

All responses include public security headers. API responses use `Cache-Control: no-store`.

JSON mutation routes require the exact `application/json` media-type token and CSV import requires the exact `text/csv` token; media-type matching is case-insensitive and permits parameters such as `charset=utf-8`. Prefix lookalikes such as `application/jsonp` or `text/csvx` return bilingual `UNSUPPORTED_MEDIA_TYPE` before the Worker reads the body or performs a D1/R2 write. Correcting the header permits a safe retry under the route's existing role, workspace, version and idempotency rules.

The public health endpoint is the only API route that does not require Access. Every other `/api` request first verifies the Access identity and applies the subject-keyed rate limit, then matches one exact path-and-method policy before resolving a D1 workspace membership. Unknown or legacy paths return the same generic bilingual `NOT_FOUND` response without echoing the requested fragment. A known path with a disallowed method returns bilingual `METHOD_NOT_ALLOWED` and its exact `Allow` header. Both preflight failures occur before request-body, membership-D1, R2 or Workflow work.

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

Requires a valid Cloudflare Access assertion, an invited active user and at least one active workspace membership. The assertion is limited to 16 KiB before verification. A verified identity-based application token must contain a control-character-free subject of at most 256 characters and a syntactically valid email of at most 254 characters; its optional display name is limited to 128 characters. Invalid or oversized input returns bilingual `ACCESS_TOKEN_INVALID` without echoing the value or reaching Rate Limiting or D1. Before any protected D1 work, the verified subject is converted to a fixed-length, versioned SHA-256 rate-limit key; the raw subject is not passed to the binding or request log. It returns the current user display data, selected workspace and allowed workspace summaries.

The request may include `X-RigStage-Workspace-Id`. The Worker treats it only as a transient request and accepts it only when D1 confirms active membership. For an already-bound identity, GET resolution does not update `last_workspace_id`, user timestamps or audit records, even when the requested active workspace differs from the persisted preference; ordinary dashboard, catalogue, asset and build reads share this no-preference-write resolver. First-login subject binding remains one bounded exception and rechecks the active user, selected workspace and membership in its conditional D1 update. A concurrent revocation returns bilingual `INVITE_REQUIRED` without binding the subject, while a concurrent different-subject winner returns `IDENTITY_BINDING_CONFLICT`.

## `PUT /api/session/workspace`

Explicitly persists the selected workspace for an already-bound identity and returns the resulting session representation. The fixed URL and empty body contain no workspace ID; the target is accepted only from the bounded `X-RigStage-Workspace-Id` header after Access verification, subject-keyed rate limiting and active membership resolution. The conditional D1 update repeats the bound subject, active user, target workspace and active membership checks at the write boundary. A concurrent revocation returns bilingual `WORKSPACE_FORBIDDEN` without changing the previous preference and can be retried after authorized reactivation. Repeated reads never call this mutation automatically; the browser uses it only for an explicit workspace-switch action. It keeps rendering the previous verified workspace while the PUT is pending and adopts only a response whose `currentWorkspace.id` matches the requested target. A target-only denial, mismatched success body or transient failure leaves that previous client scope intact and presents bilingual retry and stay actions; `401`, `INVITE_REQUIRED` and `IDENTITY_BINDING_CONFLICT` invalidate the stale session and return to the login gate.

Browser API requests send `X-Requested-With: XMLHttpRequest`. An expired Access application session therefore returns `401`; the UI performs a top-level navigation to re-enter the Access login flow rather than adding an application bypass.

## `GET /api/workspaces`

Uses the same read-only authentication and workspace resolution path and returns only the caller's active workspace summaries. It never persists the requested workspace for an already-bound identity.

## `GET /api/workspace/members`

Requires an owner or admin role and returns at most 100 users joined to memberships in the resolved workspace. Each protected record contains the member ID, email, display name, role, membership status, identity state, non-negative membership version and timestamps. `identityState` distinguishes an unbound invitation, a bound Access identity and an application-level blocked user without returning the Access subject. The response has a `hasMore` flag and remains `private, no-store`; it never writes state.

## `POST /api/workspace/members`

Requires an owner or admin role and a JSON body of at most 32 KiB containing a valid email, bounded display name and assignable role. An owner may invite owner/admin/staff/viewer; an admin may invite only staff/viewer. For a new identity, the route creates an `invited` user with no Access subject; for an existing active identity, it reuses that protected user without changing the subject or display data. It creates an active version-0 membership and a minimal audit event in one transactional D1 batch. Duplicate memberships or unavailable identities fail without partial state. This invitation does not modify Cloudflare Access policy: a deployment administrator must separately add or retain the exact same email in the private Access Allow list. On the first verified login of a new identity, the Worker conditionally activates and binds the invited user only while its membership remains active.

## `PATCH /api/workspace/member`

Requires an owner or admin role and carries one bounded private member ID in `X-RigStage-Workspace-Member-Id`; the fixed URL and bounded JSON body contain no target ID. The body supplies `expectedVersion`, `role` and active/suspended membership status. Owners may manage any other member, while admins may manage only staff/viewer targets and may assign only those roles. Self-management is rejected. The membership update and minimal audit event are submitted in one D1 batch and require the current version; a stale replay cannot overwrite or append a second audit. Independent D1 triggers reject any update, demotion, suspension or deletion that would leave no active owner.

## `GET /api/dashboard`

Returns read-only counts for the resolved workspace: active and verified catalogue records, approved and pending visual assets, draft builds, and compatibility readiness across the latest 50 drafts. Recent work combines at most six asset-review or build items. Each item requires `detailZhHant` and `detailEnglish` of 1–240 characters plus `statusZhHant` and `statusEnglish` of 1–80 characters. Asset-review items use the exact `href` `/asset-review` and include a protected `targetAssetId` for the current workspace; build items use `/builder` and a null target. The client transfers an asset target only through transient workspace-bound memory and never serializes it into the URL or visible interface. The route performs no writes, appends no audit event and returns no user identity.

## `GET /api/catalogue`

Returns active catalogue parts from the resolved workspace. `limit` defaults to 50 and is bounded to 100; `category` accepts only a known component category. A subsequent page sends the previous protected response's `nextCursor` in `X-RigStage-Catalogue-Cursor`. The Worker rejects every `cursor` query parameter and validates the header as one bounded record ID, keeping the private cursor out of browser URLs and request logs. The cursor never selects the workspace: the verified request context remains the first D1 predicate. Each record includes structured specifications, its verification status and a non-negative record version. The response contains `items` and a nullable `nextCursor`, remains protected and uses `Cache-Control: no-store`.

## `POST /api/catalogue`

Creates one active catalogue part in the resolved workspace. Viewer roles cannot mutate. The JSON body is limited to 32 KiB and must contain a valid SKU, category, manufacturer, model, HKD price in minor units, consistent stock status and count, structured specifications and their verification status. SKU values are unique within a workspace.

The catalogue row and a minimal audit event are submitted in one D1 batch. The response is the created record with version `0`.

## `POST /api/catalogue/import`

Imports a CSV document using the exact `Content-Type: text/csv` media-type token, with optional parameters. The body is limited to 256 KiB and must contain the exact documented template headers and between 1 and 50 valid rows. Duplicate SKU values within the document or the resolved workspace reject the complete import.

Every catalogue insert and its minimal audit event are submitted in one transactional D1 batch. The route never partially imports a rejected document.

## `PATCH /api/catalogue/part`

Targets one active catalogue part through `X-RigStage-Catalogue-Part-Id` and updates or archives it inside the resolved workspace. The fixed URL and bounded JSON body never contain the private part ID. Viewer roles cannot mutate. The role and bounded target header are checked before the body or D1; a missing or malformed target returns bilingual `CATALOGUE_PART_NOT_FOUND`. Both actions require `expectedVersion`; a stale value fails without overwriting the newer record. Updates accept the same bounded catalogue fields as creation. A category cannot change while the part is referenced by an existing build; this returns bilingual `CATALOGUE_CATEGORY_LOCKED` without changing the part, selection or audit history. Archive is a logical state transition and returns no body. A part with any reserved generation entitlement returns bilingual `CATALOGUE_GENERATION_LOCKED`, remains active and writes no archive audit. The user can retry with the same catalogue version after the Workflow fails or after an owner/admin approves or rejects the generated draft and settles or releases the reservation.

The conditional catalogue update and minimal audit event are submitted in one D1 batch. The update rechecks the reserved-entitlement condition at its D1 write boundary. A database trigger independently prevents an `awaiting_review` generated draft with reserved credit from being hidden by another catalogue status update.

## `GET /api/builds`

Returns at most 50 active draft summaries from the resolved workspace, ordered by the latest update. A read never creates a build or appends an audit event.

## `POST /api/builds`

Explicitly creates one workspace-scoped draft. Viewer roles cannot mutate. The bounded JSON body contains a name and at most nine unique active catalogue part IDs, with no more than one part per component category. The build, selections and minimal audit event are submitted in one D1 batch. A database trigger rechecks that every selected part remains active at insertion time; an archive race returns `BUILD_SELECTION_INVALID` and rolls back the complete batch.

## `GET /api/build`

Requires one bounded build ID in `X-RigStage-Build-Id` and returns the matching draft from the resolved workspace with its selected catalogue records, current total price, deterministic compatibility findings, summary counts and non-negative version. The fixed URL and request body never contain the private build ID, and the response never exposes the server mutation token. A missing or malformed header returns bilingual `BUILD_NOT_FOUND` before D1 work.

## `PATCH /api/build`

Targets the draft through `X-RigStage-Build-Id` and updates its name and complete selected-part set, or logically archives it. Viewer roles cannot mutate. The role and bounded target header are checked before the JSON body or D1 is read. Both actions require `expectedVersion`. Update statements use a new server-only mutation token to gate deletion, replacement selections and the minimal audit event in one D1 batch. A stale version cannot replace a newer selection, and a part archived after selection validation aborts the batch without removing the previous selection.

## `GET /api/build/export`

Targets the draft through `X-RigStage-Build-Id` and returns a schema-2 portable JSON attachment only when every fixed compatibility rule has neither an `error` nor an `unknown` result. Warnings remain visible. It includes the build record version and each component's catalogue record version so two exports can identify a changed source revision even when the build selection version is unchanged. This is current-state revision evidence, not an immutable snapshot or digest. The response omits users, workspace and internal build IDs, price, stock, asset metadata, object keys, checksums and deployment data. Legacy dynamic build-ID API paths are not routed.

## `GET /api/assets/review-queue`

Returns at most 50 draft or in-review assets from the resolved workspace, with their catalogue identity, fixed checklist identifiers, source-rights flag, human-verified dimensions, review version and safe file metadata. It never returns private object keys, checksums or provider responses.

## `GET /api/assets/item`

Requires one bounded asset ID in `X-RigStage-Asset-Id` and returns the matching active catalogue asset from the resolved workspace, including approved records. The fixed URL contains no private asset ID; a missing or malformed target returns bilingual `ASSET_NOT_FOUND` before D1. The response uses the same safe representation as the review queue.

## `POST /api/catalogue/part/source`

Targets an active catalogue part through `X-RigStage-Catalogue-Part-Id`, creates a new draft asset and uploads its first private source image. The role and bounded target header are checked before the binary body, D1 or R2; the private part ID is absent from the fixed URL and file body. Viewer roles cannot mutate. The binary body must be a static JPEG, PNG or WebP, match its declared MIME type and be at most 10 MiB. Before any R2 or D1 write, container-level validation requires bounded positive dimensions of at most 8,192 px per edge and 24 MP total, plus a complete PNG chunk sequence with valid CRCs, a bounded JPEG marker/frame/scan sequence ending at EOI, or an exact still-WebP RIFF sequence with a parseable bitstream header. APNG control/frame chunks and animated WebP are rejected. A signature-only, truncated, checksum-corrupted, dimension-unsafe, animated or MIME-mismatched body returns bilingual `VALIDATION_ERROR`. This boundary validates container structure, not image provenance or visual meaning.

The validated object is stored under an opaque private R2 key, with its computed SHA-256 supplied to R2 so the upload itself is integrity-checked. The workspace-scoped asset row and minimal audit event are committed in one D1 batch. A D1 trigger rechecks that the catalogue part is still active at insert time; if it was archived after the initial lookup, the whole batch rolls back, the new R2 object is removed and bilingual `CATALOGUE_PART_NOT_FOUND` is returned. A retry is safe after an authorized user restores the part, while the one-asset-per-part constraint rejects a successful replay. The response never contains the object key or checksum. Legacy dynamic part-ID API paths are not routed.

## `PUT /api/assets/item/file`

Requires a bounded asset ID in `X-RigStage-Asset-Id`, `source` or `model` in `X-RigStage-Asset-File-Kind`, and the current version in `X-RigStage-Expected-Version`. It replaces that file for a non-approved asset; neither the fixed URL nor binary body contains the private asset ID. Viewer roles fail before the Worker reads either target, the body, D1 or R2. Missing or malformed targets fail before body or storage work. Source files use the same image rules as creation. Models must be a complete, self-contained glTF 2.0 GLB with a matching binary header and declared length, at most 25 MiB. Before storage, manual models receive the same buffer／bufferView／accessor bounds, triangle-only primitive checks, node-graph and effective-dimension limits, and texture count／byte budgets as generated drafts. External resource URIs and unbounded renderable structures are rejected.

A successful replacement increments the review version and resets the checklist, dimensions and approval state. The new R2 object is stored with its SHA-256 integrity check before the conditional D1 batch. A database trigger rechecks that the linked catalogue part is still active at this write boundary. If an archive wins the race, the whole D1 batch rolls back, the new object is removed, the previous object remains and workspace-safe `ASSET_NOT_FOUND` is returned. Reactivating the part permits a retry with the unchanged asset version. After a committed transition, the previous private object is removed separately.

## `GET /api/assets/item/file`

Requires the same bounded `X-RigStage-Asset-Id` and `X-RigStage-Asset-File-Kind` target headers, then streams a private `source` or `model` file only after Access verification and active workspace membership resolution. The private asset ID is absent from the fixed URL. Before streaming, the R2 object's byte size, content type and SHA-256 must still match the validated D1 metadata. New objects use R2's stored SHA-256 metadata for the streaming path; an older object without that metadata receives a bounded read-back, file validation and digest comparison before any bytes are returned. A missing, malformed, invalid or mismatched target/object returns bilingual `ASSET_FILE_NOT_FOUND` without writing state; an R2 or cryptographic operational failure remains an internal failure and can be retried. A successful response is `private, no-store` with a generic filename. The browser creates a temporary object URL only while the matching workspace/asset request signal remains active and revokes it idempotently on abort or cleanup; a cancelled late response does not create a URL. Permanent object URLs and keys are never returned. Legacy dynamic asset-file paths are not routed.

## `PATCH /api/assets/item/review`

Targets one asset through `X-RigStage-Asset-Id` and accepts a JSON body of at most 32 KiB with `action`, `expectedVersion`, `completedChecks` and `dimensionsMm`; neither the fixed URL nor body contains the private asset ID. Viewer roles receive bilingual `ROLE_FORBIDDEN` before the Worker reads the target or body or performs D1/R2 work. For a write-capable role, a missing or malformed target returns bilingual `ASSET_NOT_FOUND` before the body, D1 or R2. Staff may save drafts; owner or admin roles may also approve or reject. Approval requires every fixed checklist item, three positive dimensions of at most 10,000 mm and a private GLB whose R2 object still exists with the recorded byte size and `model/gltf-binary` metadata. Before committing approval, the Worker bounds the object to 25 MiB, reads it back, repeats the complete shared GLB resource-safety policy and compares its SHA-256 with D1. Missing, invalid or same-metadata checksum-drifted storage returns bilingual `ASSET_MODEL_REQUIRED` without a review or audit write; restoring the exact validated object permits a retry at the same asset version. An R2 read or cryptographic operational failure remains an internal failure and can be retried. Legacy dynamic detail and review paths are not routed.

The conditional asset update, review event and audit event are submitted in one D1 batch. A database trigger requires the linked catalogue part to remain active when the asset update executes. If a concurrent archive commits first, the review, audit and any generation-credit transition all roll back, workspace-safe `ASSET_NOT_FOUND` is returned and the original asset version can be retried after reactivation. A stale `expectedVersion` fails without overwriting the newer record.

## `GET /api/assets/item/generation-jobs`

Requires one bounded asset ID in `X-RigStage-Asset-Id`, then returns the active generation capability and at most 20 recent jobs for that asset in the resolved workspace. The private target is absent from the fixed URL, and a missing or malformed target returns bilingual `ASSET_NOT_FOUND` before D1. Viewer roles may read status. Capability includes the mode, zero monetary cap and the workspace's non-monetary available/reserved/settled/released generation units. Each public job contains only its ID, asset ID, provider-neutral simulation kind, stable status, output-ready flag, stable failure code, entitlement status, bounded provider cost units, stable validation code and timestamps. Non-null `failureCode` and `validationCode` values must match `^[A-Z][A-Z0-9_]{0,127}$`; a malformed stored value fails response parsing instead of being serialized.

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

## `POST /api/assets/item/generation-jobs`

Targets one asset through `X-RigStage-Asset-Id` and creates a zero-monetary-cost simulation job only when the runtime capability is explicitly set to simulation. The private asset ID is absent from the fixed URL and JSON body. The route rejects non-owner/admin roles before reading the target or body; for an authorized role, a missing or malformed target returns bilingual `ASSET_NOT_FOUND` before capability, idempotency, body, D1, R2 or Workflow work. A valid `Idempotency-Key`, an unapproved asset, its current `expectedVersion`, a stored private source image, a previously saved source-rights confirmation and at least one available non-monetary generation credit are required. Before reserving credit, the route requires the source R2 object to match the D1-recorded byte size, content type and SHA-256; objects without stored R2 SHA-256 metadata use a bounded read-back. Missing or drifted storage returns bilingual `GENERATION_SOURCE_REQUIRED` without creating a job, credit event, audit event or Workflow; an R2 or cryptographic operational failure remains an internal failure and can be retried. Legacy dynamic generation-job paths are not routed.

One D1 batch moves a credit from available to reserved and inserts the queued job, entitlement, reserve event, initial job event and minimal audit record before the uniquely identified Workflow instance is created. A D1 trigger rechecks that the catalogue part is active and the asset version, source checksum, rights confirmation and unapproved status still match at job insertion. If a catalogue archive or asset change wins after route preflight, the batch rolls back completely and bilingual `ASSET_VERSION_CONFLICT` is returned without consuming the idempotency key; an authorized reactivation can retry safely with the same key. Reusing an idempotency key with the same asset and `expectedVersion` returns the original job without another reservation or Workflow; changing either input returns bilingual `IDEMPOTENCY_KEY_REUSED`. Another job is blocked while the asset has a queued, running, validating or awaiting-human-review job with a reserved entitlement.

Successful creation returns `202`. The Workflow rechecks the active catalogue state at claim and the same private source size, content type and SHA-256 before beginning a provider attempt, closing races after route preflight. A catalogue archive before claim records `GENERATION_INPUT_STALE`, releases once and makes no provider attempt. The final staging update rechecks active catalogue state at the D1 write boundary; if a later archive wins, the private draft is removed and the reservation is released once instead of creating an invisible review draft. If the source disappears or drifts, stable failure code `GENERATION_INPUT_MISSING` releases the reservation once without a provider attempt; replaying the original idempotency key returns that terminal job. The Workflow output remains a draft and resets all prior checklist and dimension evidence before its state becomes `awaiting_review`. Approval settles the reservation. Rejection, terminal failure, Workflow-start failure or generated-draft replacement releases it once. Tracked production configuration returns `GENERATION_DISABLED` before any database write or external activity. An absent/empty credit account returns `GENERATION_CREDITS_REQUIRED` without creating a job or provider attempt.

## Errors

```json
{
  "error": {
    "code": "STABLE_CODE",
    "message": "繁體中文訊息 / Actionable English message",
    "requestId": "generated-per-request"
  }
}
```

Every public error message uses the exact `繁體中文 / English` language order. Construction fails during development and tests if either language is absent. Validation messages describe the safe corrective category while preserving the stable error code: detailed CSV parser state, GLB structure labels, private record identifiers and raw exception text are never copied into the response. Clients with separate language fields split only the first ` / ` delimiter; malformed or legacy responses use generic bilingual fallback copy.

Expected codes include `ACCESS_TOKEN_REQUIRED`, `ACCESS_TOKEN_INVALID`, `INVITE_REQUIRED`, `WORKSPACE_FORBIDDEN`, `WORKSPACE_MEMBER_NOT_FOUND`, `WORKSPACE_MEMBER_CONFLICT`, `WORKSPACE_MEMBER_VERSION_CONFLICT`, `WORKSPACE_MEMBER_SELF_FORBIDDEN`, `WORKSPACE_LAST_OWNER`, `IDENTITY_BINDING_CONFLICT`, `ROLE_FORBIDDEN`, `VALIDATION_ERROR`, `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`, `CATALOGUE_PART_NOT_FOUND`, `CATALOGUE_SKU_CONFLICT`, `CATALOGUE_VERSION_CONFLICT`, `CATALOGUE_CATEGORY_LOCKED`, `CATALOGUE_GENERATION_LOCKED`, `BUILD_NOT_FOUND`, `BUILD_SELECTION_INVALID`, `BUILD_VERSION_CONFLICT`, `BUILD_EXPORT_BLOCKED`, `ASSET_NOT_FOUND`, `ASSET_FILE_NOT_FOUND`, `ASSET_ALREADY_EXISTS`, `ASSET_LOCKED`, `ASSET_MODEL_REQUIRED`, `ASSET_APPROVAL_INCOMPLETE`, `ASSET_VERSION_CONFLICT`, `GENERATION_DISABLED`, `GENERATION_ALREADY_ACTIVE`, `GENERATION_CREDITS_REQUIRED`, `GENERATION_SOURCE_REQUIRED`, `GENERATION_RIGHTS_REQUIRED`, `GENERATION_START_FAILED`, `IDEMPOTENCY_KEY_REUSED`, `RATE_LIMITED`, `METHOD_NOT_ALLOWED`, `NOT_FOUND` and `INTERNAL_ERROR`.

A `405` response includes the exact route policy in `Allow`; a `429` response includes `Retry-After: 60`. Unexpected internal errors never expose raw exception messages.
