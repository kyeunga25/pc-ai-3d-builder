# Test plan

## Automated checks

```bash
npm run check
npm run test
npm run build
npm run cf:dry-run
npm audit --audit-level=high
```

Current unit tests cover:

- domain schema and locale formatting;
- synthetic session parsing;
- Access JWT validation failures and accepted claims;
- required application-token type and rejection of expired Access assertions;
- one configured Access audience and a bounded multi-application audience allowlist, including fail-closed empty, duplicate, oversized and over-count values;
- exact protected SPA parent/deep-route matching and Static Assets Worker-first configuration;
- AJAX expiry signaling and top-level re-login/logout paths;
- workspace membership selection and tampering rejection;
- concurrent first-login subject binding, active-membership revocation at the binding boundary and guarded workspace-switch persistence;
- subject-keyed API rate limiting;
- read-only session responses;
- audit helper serialization;
- health response and public security headers;
- exact JSON/CSV media-type token matching, parameter acceptance and prefix-spoof rejection before body reads or database work;
- bounded, workspace-scoped catalogue pagination and filters;
- catalogue writer role checks, SKU conflicts, optimistic versions and logical archive;
- catalogue archive rejection while a linked generation credit remains reserved, followed by safe recovery after human rejection;
- strict CSV parsing and transactional imports of at most 50 catalogue records;
- image MIME, size, bounded-dimension and container validation, including PNG ordering/CRC, JPEG frame/scan/EOI bounds, WebP RIFF length/zero padding/still or animation-frame bitstream headers, 120-frame and aggregate-pixel animation caps, and rejection before R2 or D1 writes; plus strict GLB size, length and self-contained structure validation;
- workspace-scoped private R2 creation with upload checksum enforcement, replacement, rollback cleanup and reads that fail closed on missing or drifted size, content type or SHA-256;
- review and private-file replacement rollback when catalogue archive wins at the asset-update boundary, followed by same-version recovery after reactivation;
- GLB-required approval with bounded R2 read-back, structural validation and SHA-256 recheck, plus review reset after file replacement;
- bounded JSON mutation bodies;
- asset-review role checks, complete-approval requirements and stale-version rejection;
- atomic review and audit statement construction without identity data in metadata;
- deterministic build compatibility pass, warning, error and unknown outcomes;
- workspace-scoped build list, role checks, guarded optimistic mutations and portable export;
- schema-2 export revision evidence, viewer read access, changed catalogue-version visibility without a build write, and exclusion of build/workspace identity, price, stock and private-asset fields;
- read-only workspace dashboard aggregates, empty state and identity exclusion;
- guarded logical archive for a build draft.
- generation capability fail-closed parsing and disabled-provider behavior;
- runtime synthetic GLB structure and strict container, chunk, buffer-view, accessor, node-graph, dimension, triangle, texture and external-URI validation;
- owner/admin generation role checks, saved source-rights requirement, current review version and matching R2 source size, content type and SHA-256 before reservation;
- generation reservation, Workflow claim and draft staging fail closed when the catalogue part is archived at each D1 boundary;
- workspace-scoped generation job listing without private object or Workflow data;
- idempotent, zero-cost job creation with exactly one capability reservation before Workflow start, including rejection of cross-asset key reuse;
- immutable provider-attempt disposition for duplicates, out-of-order results, conflicts and late completion;
- exact-once capability settlement after approval and release after rejection, replacement, post-preflight source loss or terminal failure;
- payment provider boundary remaining disconnected and disabled.
- private owner-onboarding input validation, idempotent owner/workspace SQL and optional bounded credit-account creation.

Workers Runtime integration tests apply the real migrations and use Miniflare/workerd D1, R2 and Workflow bindings. Workspace-auth tests suspend membership immediately before first-login subject binding or workspace-switch persistence, verify no identity/selection write, recover after reactivation, preserve a concurrent different-subject winner and accept a same-subject repeat. Catalogue-import tests verify workspace-scoped SKU uniqueness, replay rejection and full rollback of earlier rows and audit events when a later insert conflicts. Catalogue-write tests verify a bilingual category-lock conflict for build-referenced parts, permitted same-category edits, stale replay rejection, cross-workspace not-found behavior and unchanged references or audit history after denied writes. They also verify that a direct D1 update and the application archive both preserve an `awaiting_review` generated asset with reserved credit, expose no cross-workspace lock state, append no denied audit, and archive with the original catalogue version after human rejection releases the credit once. Asset-creation tests hide foreign parts, force an archive immediately before the insert batch, verify D1 rollback and R2 cleanup, recover after reactivation and reject a successful replay. Private-asset tests verify owning-workspace reads, reject drifted R2 size, content type or same-metadata checksum without state changes, hide both reads and replacements from another workspace, and force an archive before replacement commit to verify D1 rollback, new-object cleanup, old-object retention, same-version recovery and stale-replay rejection. Asset-review tests verify staff draft saves, admin approval, role denial, cross-workspace not-found behavior, stale replay rejection, missing and mismatched R2 model rejection, same-size/MIME invalid bytes and structurally valid checksum drift without review or audit writes, followed by successful recovery after the exact validated GLB is restored. They also prove direct and application asset updates abort without review or audit writes when the catalogue part is archived, then recover with the original version after reactivation. Persistent-build tests verify owning-workspace detail and portable export, cross-workspace not-found behavior, warning-only export, fail-closed hard-error or unknown compatibility results, one guarded full-selection replacement that rejects stale and foreign updates, and create/update rollback when a selected part is archived immediately before the D1 batch. Generation tests reject missing, metadata-drifted or same-metadata checksum-drifted R2 source storage without reservation, recover with the same idempotency key, fail a post-preflight source race before provider work with exact-once release, roll back the full reservation batch when catalogue archival wins job insertion, fail before a provider attempt when archival wins Workflow claim, remove the private draft when archival wins staging, safely replay terminal results, force a transient post-storage validation retry, and verify one successful provider attempt, one reservation, deterministic private output, stored R2 SHA-256 metadata, read-back validation and approval settlement. A terminal validation failure verifies draft cleanup and exact-once release.

## Migration check

Apply all numbered migrations to an empty local database and confirm schema phase `14`, the active-build-selection, active-asset-creation, active-asset-mutation, current-generation-input and reserved-generation-archive triggers, catalogue record-version column, private asset-file metadata columns, `builds`, `build_items`, `generation_jobs`, `generation_job_events`, `generation_credit_accounts`, `generation_credit_events`, `generation_job_entitlements` and `generation_provider_attempts`, and no rows from `PRAGMA foreign_key_check`. Confirm that inactive catalogue selections, asset creation, asset mutation or generation-job insertion for an inactive part, stale generation inputs, archive of an `awaiting_review` reserved generation, duplicate workspace idempotency keys, duplicate provider-attempt references and concurrent active jobs for one asset are rejected. Insert only synthetic workspace, catalogue, asset, generation-job, capability and build fixtures when checking relational constraints. Never use a local copy of production data.

## Browser check

Test the built application at desktop and tablet widths. Confirm:

- `/` 在不建立 session 的情況下顯示完整產品介紹，並以 top-level navigation 導向 `/dashboard` 登入入口；
- `/dashboard`、`/catalogue`、`/asset-review`、`/builder` 及各自 deep route 在 Static Assets 前要求有效 Access identity 與 active D1 membership；
- 首頁的流程、安全邊界及 invite-only 指引在桌面和 390 px 均完整可讀；
- 首頁的 Dashboard、產品目錄、素材審核及 Builder 合成工作區畫面均可載入、放大查看，且不包含真實商戶或私人素材；
- 首頁的正文、案例、圖說及輔助文字在桌面和 390 px 均維持適合繁體中文閱讀的字級、行距及對比；
- the authentication loading and failure states are readable;
- logout clears the Access application session, re-login uses a top-level navigation, and an expired AJAX session returns a bounded authorization failure;
- every navigation item is keyboard reachable;
- the builder route loads lazily;
- no horizontal overflow obscures primary actions;
- reduced-motion preferences disable non-essential animation;
- UI fixtures remain visibly synthetic;
- catalogue search filters the rendered synthetic records;
- catalogue create, edit and two-step archive actions update synthetic state;
- a valid synthetic CSV document imports records, while malformed or duplicate data shows a bounded error;
- a synthetic PNG creates a private asset draft from the catalogue;
- a synthetic GLB unlocks the manual Three.js preview and remains required for approval;
- desktop and 390 px layouts show source and model controls without page-level horizontal overflow;
- completing the final asset checklist item enables approval, and approval locks the reviewed fields;
- local preview starts with two clearly non-monetary capability credits and requires a saved source-rights confirmation before enabling zero-cost simulation;
- local simulation reserves exactly one capability credit, creates a runtime synthetic GLB, records one provider cost unit, marks the job waiting for review, resets all checklist/dimension evidence and never labels the output approved;
- a second generation is blocked while the first reservation awaits review;
- approving the synthetic draft settles the reservation once and opens the approved synthetic model in Builder; rejecting or replacing it releases the reservation once;
- production capability remains disabled unless a separately reviewed private configuration enables simulation;
- a verified 9-category build reports six passing rules and enables export;
- changing a GPU to one above the selected PSU recommendation produces a warning;
- unsaved changes disable export, saving increments the local version and re-enables export;
- an explicitly created empty build produces unknown results and blocks export;
- the first archive action arms confirmation, the second produces the empty state, and explicit creation restores a draft;
- camera, wireframe and fit controls are disabled when no approved GLB is available;
- dashboard metrics and recent-work links use explicit synthetic local data without fixed operational claims;
- dashboard and builder have no page-level horizontal overflow at 390 px;
- the 390 px builder layout exposes the inspector drawer.

## Deployment check

Use a mode-`0600`, Git-ignored deployment configuration with `workers.dev` and preview URLs disabled. Verify the public health endpoint, static deep-link fallback, protected session, every workspace parent/deep route, dashboard, build, generation-job and private-file rejection without Access, security headers and absence of source maps. Confirm exact-email Access Allow policy behavior for the owner and denial for an uninvited identity. Confirm that tracked production configuration reports generation disabled and rejects job creation before a D1 write. Do not print or record identities, tokens or deployment identifiers during validation.

The local generation milestone is not a provider-readiness check and must not be represented as real-provider, preview or production-generation evidence.
