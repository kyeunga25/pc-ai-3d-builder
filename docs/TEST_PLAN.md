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

- domain schema, locale formatting and safe splitting of combined bilingual error copy;
- exhaustive typed bilingual landing-entry coverage for header navigation, hero, actions, proof points, synthetic screenshot context, four trust boundaries, final sign-in and footer; bilingual ARIA names; same-origin/root/section/local-image links; protected-identifier absence; reduced-motion preservation; and phone-width wrapping;
- exhaustive typed bilingual landing workflow coverage for the section introduction, three labels, titles, descriptions, nine evidence points, three local synthetic screenshot alternatives/captions, use-case introduction and three situation/response pairs;
- synthetic session parsing;
- Access JWT validation failures, deterministic concurrent claim normalization and accepted boundary values;
- required identity-based application-token type plus rejection of expired, oversized or malformed assertions and bounded subject, email and display-name claims before Rate Limiting or D1;
- one configured Access audience and a bounded multi-application audience allowlist, including fail-closed empty, duplicate, oversized and over-count values;
- exact protected SPA parent/deep-route matching and Static Assets Worker-first configuration;
- AJAX expiry signaling and top-level re-login/logout paths;
- exhaustive typed bilingual login copy for the introduction, identity/membership/fail-closed boundaries, five login reasons, fixed destination labels, Access continuation, unauthorized logout, public-home recovery and footer; bilingual ARIA labels; root-only return targets with dynamic identifier/query/fragment absence; and phone-width wrapping;
- workspace membership selection and tampering rejection;
- concurrent first-login subject binding, active-membership revocation at the binding boundary, zero preference writes during bound-identity reads and guarded explicit workspace-switch persistence;
- bounded workspace-member schemas, nullable private pagination cursors, owner/admin role assignment rules and normalized invitation input;
- protected member-directory API transport, private target IDs limited to a fixed request header, bilingual Access-policy separation, owner/admin-only navigation and phone-width controls without visible member IDs;
- owner/admin-only activity action normalization, 50-row workspace-first pagination, fixed-header cursor transport, foreign/malformed cursor denial, raw metadata/identity/target/request exclusion, system-actor fallback, bilingual category filtering and phone-width cards without visible private identifiers;
- versioned subject-digest API rate limiting, including raw-identifier exclusion, deterministic replay/concurrency and distinct actor keys;
- read-only session responses plus fixed-URL, header-only workspace-selection requests, matching-target response enforcement and a client state machine that retains the previous scope on recoverable failures while invalidating it on global identity denial;
- audit helper serialization;
- health response and public security headers;
- exact API route/method policy, generic unknown-path handling, protected Access-plus-rate-limit preflight before membership D1, public health isolation, exact `Allow` headers and bilingual `METHOD_NOT_ALLOWED` responses;
- construction-time rejection of single-language public API errors, bilingual 404/405/429/500 serialization and safe client fallback when an upstream message is absent;
- exact JSON/CSV/TSV media-type token matching, parameter acceptance and prefix-spoof rejection before body reads or database work, plus strict bodyless-operation rejection without consuming or reflecting supplied bytes;
- bounded, workspace-scoped catalogue pagination and filters, including transient header-only cursor transport, rejection of URL or malformed cursors and unchanged workspace-first D1 binding;
- exhaustive bilingual Catalogue-list coverage for page guidance, actions, search/category/verification filters, table columns, nine categories, four stock states, four asset states, four quality states, stock singular/plural/unknown counts, privacy-safe product actions, viewer-disabled writes, private-ID absence and phone-width wrapping;
- exhaustive bilingual Catalogue-editor coverage for create/edit/view headings, version, all fields, nine category choices, four stock states, both specification-verification choices, JSON guidance and every archive/asset-draft/save stage; viewer-disabled fields and omitted mutations; private part/asset ID absence; associated labels; and phone-width copy/action wrapping;
- catalogue writer fixed-URL header targets, malformed-target rejection before body/D1/R2, generic legacy-path logging, role checks, SKU conflicts, optimistic versions and logical archive;
- enumerated bilingual Catalogue read/write/archive/asset-draft/import states, separate CSV／TSV template outcomes, safe replacement of monolingual technical errors, ambiguous-write reload guidance, semantic status/alert tones and bilingual mutation controls;
- catalogue archive rejection while a linked generation credit remains reserved, followed by safe recovery after human rejection;
- CSV／TSV file-name and media-type agreement, 256-KiB and fatal UTF-8 client preflight, shared strict delimiter/quote/header/schema parsing, bilingual format-specific row validation and transactional imports of at most 50 catalogue records;
- shared Catalogue/Asset Review browser preflight for `.jpg`／`.jpeg`／`.png`／`.webp`／`.glb`, including filename/MIME/content agreement, safe canonical MIME for empty or `application/octet-stream` browser metadata, unsupported/conflicting extension rejection before fetch and local filename absence from requests; independent Worker image MIME, size, 8,192 px／24 MP decode budget and container validation, including PNG ordering/CRC, JPEG frame/scan/EOI bounds, WebP RIFF length/zero padding/still bitstream headers, explicit APNG／animated-WebP rejection, and rejection before R2 or D1 writes; plus strict manual-and-generated GLB size, buffer/accessor, node-graph, dimension, triangle, texture and self-contained structure validation with detailed validator messages reduced to stable bilingual public categories;
- fixed-URL header-only private-file targets with viewer and malformed-target rejection before body/D1/R2; exact source-view enumeration, `front` backward-compatible default and model/source-view rejection; bodyless removal; generic legacy-path logging; workspace-scoped R2 creation with upload checksum enforcement; selected-view replacement and removal isolation; metadata-first exact-key cleanup; no delete for missing, approved, stale or raced targets; one bounded transient delete retry; persistent-failure suppression after two attempts; and reads that fail closed on missing or drifted size, content type or SHA-256;
- abort-bound browser object URLs for remote private files, including no materialization after cancellation, immediate cleanup when cancellation wins during creation and exact-once revocation after abort or explicit release;
- review, private-file replacement and private-file removal rollback when catalogue archive wins at the asset-update boundary, followed by same-version recovery after reactivation;
- typed bilingual Asset Review progress/success/warning/error notices, status-versus-alert semantics, operation-specific ambiguous-result fallbacks, preservation of bounded bilingual API/file-validation messages and action-specific progress copy;
- enumerated bilingual four-view source-image and GLB requirements plus selected-view upload, replace, remove, confirmation and progress labels; rendered Access-boundary and complete evidence-reset guidance; accurate exact-file scope; and narrow-layout wrapping without page-level overflow;
- exhaustive bilingual coverage and canonical ordering for every domain approval check, typed width/height/depth labels, rendered human-verification guidance, singular/plural progress copy and one-column phone-width dimension fields;
- exhaustive bilingual coverage for the four canonical Asset Review camera presets, tool accessibility names, selected-camera and model-availability states, the visual-evidence boundary, generic shared GLB loading/failure copy and a wrapping auto-height viewport footer;
- exhaustive bilingual coverage for all four selectable source-image views, exactly one pressed state, authorized/missing states, private preview and actionable missing-view accessibility text, confirmed/missing usage-rights states, semantic success/warning presentation and bounded phone-thumbnail labels;
- exact bilingual enum coverage for every Asset Review status, source kind and quality value; rendered header guidance, metadata labels, version and queue context; English queue singular/plural; absence of the internal asset ID; and a wrapping narrow-screen status badge;
- rejection intent that arms without submitting on the first request, submits only on a second request for the same workspace and asset version, and re-arms without submission for a changed version;
- private-file removal intent that arms without a request on the first activation, submits only on a second activation for the same workspace, asset version, kind and view, and disarms after view, form, upload, generation or review changes;
- queued-generation cancellation intent that arms without a request on the first activation, submits only on a second activation for the same workspace, asset version and job, uses bilingual warning/progress/success/uncertainty states, and renders no private job ID;
- generation history that preserves server order, filters out another asset, caps visible rows at 20, formats ISO/D1 timestamps in Hong Kong time, fails closed on an invalid timestamp and renders no job ID or stable failure code;
- GLB-required approval with bounded R2 read-back, structural validation and SHA-256 recheck, plus review reset after file replacement or removal;
- bounded JSON mutation bodies;
- fixed-URL header-only asset detail/review targets, malformed-target rejection before body/D1/R2, generic legacy-path logging, viewer rejection, complete-approval requirements and stale-version rejection;
- atomic review and audit statement construction without identity data in metadata;
- deterministic build compatibility pass, warning, error and unknown outcomes;
- workspace-scoped build list, fixed-URL header-only build targets, malformed-target rejection before D1, generic logging of legacy dynamic paths, role checks, guarded optimistic mutations and portable export;
- enumerated bilingual Builder create/switch/save/archive/export states, safe replacement of monolingual technical errors, versioned success messages, semantic status/alert tones and bilingual Save/Export controls;
- exhaustive bilingual Builder command-bar labels for workspace/build context, Dashboard navigation, switching, naming, creation, both archive stages, inspector access and account accessibility; viewer omission of create/archive controls; disabled name editing; wrapping labels; and compact icon accessibility;
- responsive Builder inspector-drawer modal labelling, bilingual title and close actions, private-asset-ID absence, Escape/Tab keyboard decisions, first/last focus wrapping, compact heading wrapping and contained overscroll styling;
- exact bilingual Builder-inspector coverage for all three tabs, four compatibility severities, four asset states, four asset-quality states and both specification-verification states; known and custom specification labels; evidence labels; stock singular/plural; empty guidance; approved-only manual-preview wording; private-ID absence; and wrapping inspector badges and copy;
- exhaustive bilingual Builder-viewport coverage for four cameras, three display modes, ten component steps and four stock states; distinct authorized-private, local-synthetic, private-failure, local-fallback and no-approved-model copy; camera/mode/grid readouts; private-ID absence; the non-compatibility evidence boundary; and a wrapping content-height footer;
- exhaustive bilingual Builder component-rail coverage for nine component categories plus summary; error/missing/unknown/warning/complete precedence; summary error/unknown/warning/export states; candidate and selection singular/plural; in-stock, low-stock, out-of-stock, unknown and missing-count copy; empty and explicit-save guidance; viewer-disabled candidates; private-ID absence; and wrapping desktop/compact labels with semantic stock colour preserved;
- exhaustive bilingual Builder status-bar coverage for error over unknown over warning over success precedence; semantic icons and colour hooks; compatibility and selected-component singular/plural; workspace-total and Save/Export labels; privacy-safe ready/blocked export explanations; phone-width wrapping; and bilingual accessible names when action text is visually hidden;
- schema-2 export revision evidence, viewer read access, changed catalogue-version visibility without a build write, and exclusion of build/workspace identity, price, stock and private-asset fields;
- read-only workspace dashboard aggregates, empty state, identity exclusion, exact generic review links, schema-required bounded Traditional Chinese/English work detail and status, bilingual relative-time boundaries, exhaustive static interface copy, singular/plural metric summaries, empty/complete/incomplete readiness guidance, and rejection of asset IDs embedded in URLs;
- guarded logical archive for a build draft;
- fixed-URL header-only generation targets, malformed-target rejection before body/D1/R2/Workflow, generic legacy-path logging, capability fail-closed parsing and disabled-provider behavior;
- exhaustive bilingual generation-inspector mappings for every mode, job and entitlement enum, settled human-review distinction, non-monetary available/reserved and settled/released credit summaries, and bilingual absent-value copy;
- runtime synthetic GLB structure and strict container, chunk, buffer-view, accessor, node-graph, dimension, triangle, texture and external-URI validation;
- private deployment wrappers capture successful and failed Wrangler stdout／stderr, strip build-only coordinates from the child environment, retain required authentication, and expose only generic status codes to build logs;
- 1–128-character uppercase alphanumeric/underscore generation diagnostic schemas, fail-closed job-list serialization and D1 insert/update triggers for job, job-event and provider-attempt codes;
- owner/admin generation role checks, saved source-rights requirement, current review version and matching R2 source size, content type and SHA-256 before reservation;
- generation reservation, Workflow claim and draft staging fail closed when the catalogue part is archived at each D1 boundary;
- workspace-scoped generation job listing without private object or Workflow data;
- owner/admin-only bodyless cancellation of an exact workspace/asset-matched queued job, malformed/cross-workspace denial before mutation, idempotent cancelled replay, exact-once credit release and a conflict that preserves state/accounting when Workflow claim wins;
- idempotent, zero-cost job creation with exactly one capability reservation before Workflow start, including in-memory reuse after an ambiguous client result, key rotation for changed inputs, header-only transport and rejection of cross-asset or cross-version key reuse;
- immutable provider-attempt disposition for duplicates, out-of-order results, conflicts and late completion;
- exact-once capability settlement after approval and release after rejection, replacement, post-preflight source loss or terminal failure;
- payment provider boundary remaining disconnected and disabled;
- private owner-onboarding input validation, idempotent owner/workspace SQL and optional bounded credit-account creation.

Workers Runtime integration tests apply the real migrations and use Miniflare/workerd D1, R2 and Workflow bindings. Workspace-auth tests suspend membership immediately before first-login subject binding or workspace-switch persistence, verify no identity/selection write, recover after reactivation, preserve a concurrent different-subject winner and accept a same-subject repeat. Workspace-member tests verify transactional new-identity invitation plus first-login activation, safe reuse of an existing bound identity across workspaces, non-manager denial, bounded workspace isolation, stale replay without a second audit, self-management denial, admin escalation denial and the database last-owner guard for direct update and delete. Workspace-activity tests verify owner-only bounded pages, deterministic older-page seeking, unknown-action and missing-actor fallback, cross-workspace isolation, staff denial, query/malformed/foreign cursor rejection and exclusion of email, object location, target, request and metadata fields. Catalogue-import tests verify workspace-scoped SKU uniqueness, replay rejection and full rollback of earlier rows and audit events when a later insert conflicts. Catalogue-write tests verify a bilingual category-lock conflict for build-referenced parts, permitted same-category edits, stale replay rejection, cross-workspace not-found behavior and unchanged references or audit history after denied writes. They also verify that a direct D1 update and the application archive both preserve an `awaiting_review` generated asset with reserved credit, expose no cross-workspace lock state, append no denied audit, and archive with the original catalogue version after human rejection releases the credit once. Asset-creation tests hide foreign parts, force an archive immediately before the insert batch, verify D1 rollback and R2 cleanup, recover after reactivation and reject a successful replay. Private-asset tests verify owning-workspace canonical and additional-view reads, selected-view replacement without changing another view, safe per-view D1 metadata, checksum enforcement, prior selected-view R2 cleanup, generic filenames, workspace isolation and metadata-free audit records. They reject malformed source views before body/D1/R2, reject source-view headers on model requests, enforce the additional-view table's view and active-catalogue triggers, and force an archive before replacement commit to verify D1 rollback, new-object cleanup, old-object retention, same-version recovery and stale-replay rejection. The same real-binding flow removes one additional view while preserving canonical front, rejects a foreign workspace and stale replay, retains the exact object when catalogue archival wins, then removes canonical front after reactivation with one metadata-free audit event per committed removal. Asset-review tests verify staff draft saves, admin approval, role denial, cross-workspace not-found behavior, stale replay rejection, missing and mismatched R2 model rejection, same-size/MIME invalid bytes and structurally valid checksum drift without review or audit writes, followed by successful recovery after the exact validated GLB is restored. They also prove direct and application asset updates abort without review or audit writes when the catalogue part is archived, then recover with the original version after reactivation. Persistent-build tests verify owning-workspace detail and portable export, cross-workspace not-found behavior, warning-only export, fail-closed hard-error or unknown compatibility results, one guarded full-selection replacement that rejects stale and foreign updates, and create/update rollback when a selected part is archived immediately before the D1 batch. Generation tests use only canonical `front`; they reject missing, metadata-drifted or same-metadata checksum-drifted R2 source storage without reservation, recover with the same idempotency key, fail a post-preflight source race before provider work with exact-once release, roll back the full reservation batch when catalogue archival wins job insertion, fail before a provider attempt when archival wins Workflow claim, remove the private draft when archival wins staging, safely replay terminal results, force a transient post-storage validation retry, and verify one successful provider attempt, one reservation, deterministic private output, stored R2 SHA-256 metadata, read-back validation and approval settlement. A terminal validation failure verifies draft cleanup and exact-once release.

Queued-generation integration coverage additionally cancels a manually queued job, proves one release/event/audit across replay, runs the cancelled Workflow to a terminal no-provider output, permits a subsequent job, and forces a claim race that leaves the running reservation untouched.

## Migration check

Apply all numbered migrations to an empty local database and confirm schema phase `17`, the active-build-selection, active-asset-creation, active-asset-mutation, active-additional-source-view, current-generation-input, reserved-generation-archive, bounded-generation-code and last-active-owner triggers, catalogue and workspace-membership record-version columns, canonical and additional private asset-file metadata, `product_asset_source_files`, `builds`, `build_items`, `generation_jobs`, `generation_job_events`, `generation_credit_accounts`, `generation_credit_events`, `generation_job_entitlements` and `generation_provider_attempts`, and no rows from `PRAGMA foreign_key_check`. Confirm that unknown additional source views, source-view rows for inactive catalogue parts, inactive catalogue selections, asset creation, asset mutation or generation-job insertion, stale generation inputs, archive of an `awaiting_review` reserved generation, malformed generation diagnostic codes, removal of the final active owner, duplicate workspace idempotency keys, duplicate provider-attempt references and concurrent active jobs for one asset are rejected. Insert only synthetic workspace, member, catalogue, asset, source-view, generation-job, capability and build fixtures when checking relational constraints. Never use a local copy of production data.

## Browser check

Test the built application at desktop and tablet widths. Confirm:

- `/` 在不建立 session 的情況下顯示完整產品介紹，並以 top-level navigation 導向 `/dashboard` 登入入口；
- `/dashboard`、`/catalogue`、`/asset-review`、`/builder` 及各自 deep route 在 Static Assets 前要求有效 Access identity 與 active D1 membership；
- 首頁的流程、安全邊界及 invite-only 指引在桌面和 390 px 均完整可讀；
- 首頁的 Dashboard、產品目錄、素材審核及 Builder 合成工作區畫面均可載入、放大查看，且不包含真實商戶或私人素材；
- 首頁的正文、案例、圖說及輔助文字在桌面和 390 px 均維持適合繁體中文閱讀的字級、行距及對比；
- the authentication loading and failure states are readable;
- workspace switching keeps the previous scope visible until a matching success, disables repeated selection while pending, and shows readable bilingual retry/stay actions after a recoverable failure at desktop and 390 px;
- owner/admin member management shows protected bilingual identity and membership state, exact Access-policy separation, loaded counts, retry-safe continuation, safe role controls and two-step suspension without visible private member IDs; 100-record pages use a header-only cursor, reject URL/malformed/missing/cross-workspace cursors and append without duplicates; the layout becomes one column without horizontal overflow at 390 px;
- owner/admin activity shows bilingual action/category/actor/time, filters the loaded projection, loads older records through a protected header only and displays neither private IDs, email nor raw metadata; cards and controls remain readable without horizontal overflow at 390 px;
- logout clears the Access application session, re-login uses a top-level navigation, and an expired AJAX session returns a bounded authorization failure;
- every navigation item is keyboard reachable;
- the builder route loads lazily;
- no horizontal overflow obscures primary actions;
- reduced-motion preferences disable non-essential animation;
- UI fixtures remain visibly synthetic;
- catalogue search filters the rendered synthetic records;
- catalogue create, edit and two-step archive actions update synthetic state;
- valid synthetic CSV and TSV documents import records through the same schema, while oversized, mismatched, malformed or duplicate data shows a bounded error;
- a synthetic PNG creates a private asset draft from the catalogue;
- selecting each of the four source views updates exactly one pressed thumbnail and the matching file control; adding or replacing a synthetic non-front image updates only that view, switching back preserves the other previews, and canonical `front` remains the only generation gate;
- the first remove press sends no request and shows a bilingual exact-scope warning; changing view or another operation cancels it, while the second press for the unchanged target removes only that source view or GLB, resets review evidence and releases any reserved synthetic credit;
- a synthetic GLB unlocks the manual Three.js preview and remains required for approval;
- desktop and 390 px layouts show source and model controls without page-level horizontal overflow;
- completing the final asset checklist item enables approval, and approval locks the reviewed fields;
- the first reject press shows a bilingual warning, changes the button to an explicit confirmation state and sends no review request; another form action or asset/version change cancels it, while a second press for the unchanged asset submits rejection without deleting its private files;
- local preview starts with two clearly non-monetary capability credits and requires a saved source-rights confirmation before enabling zero-cost simulation;
- a synthetic queued-job fixture shows cancellation only to owner/admin, sends no request on the first activation, disarms after another action, and on the second unchanged activation changes only that job to cancelled while moving one reserved credit back to available/released; the job ID stays out of visible copy and the URL at desktop and 390 px;
- synthetic mixed generation history shows only exact current-asset rows in server order, keeps the latest marker, status, entitlement and Hong Kong time readable inside its own bounded scroll area, and exposes no job ID, failure code, provider or private object detail at desktop and 390 px;
- local simulation reserves exactly one capability credit, creates a runtime synthetic GLB, records one provider cost unit, marks the job waiting for review, resets all checklist/dimension evidence and never labels the output approved;
- a second generation is blocked while the first reservation awaits review;
- the generation inspector shows Traditional Chinese and English for the current mode, job lifecycle, entitlement, non-monetary credit, cost and validation states, wrapping at 390 px without horizontal overflow or provider/private-object detail;
- approving the synthetic draft settles the reservation once and opens the approved synthetic model in Builder; rejecting or replacing it releases the reservation once;
- production capability remains disabled unless a separately reviewed private configuration enables simulation;
- a verified 9-category build reports six passing rules and enables export;
- changing a GPU to one above the selected PSU recommendation produces a warning;
- unsaved changes disable export, saving increments the local version and re-enables export;
- an explicitly created empty build produces unknown results and blocks export;
- the first archive action arms confirmation, the second produces the empty state, and explicit creation restores a draft;
- camera, wireframe and fit controls are disabled when no approved GLB is available;
- dashboard metrics and recent-work links use explicit synthetic local data without fixed operational claims; heading, primary actions, metric summaries, recent-work detail/time/status and readiness guidance remain bilingual at desktop widths, while the 390 px icon status stays accessible and all surrounding copy wraps without horizontal overflow;
- dashboard and builder have no page-level horizontal overflow at 390 px;
- the 390 px builder layout exposes the inspector drawer.

## Deployment check

Use a mode-`0600`, Git-ignored deployment configuration with `workers.dev` and preview URLs disabled. Verify the public health endpoint, static deep-link fallback, protected session, every workspace parent/deep route, dashboard, build, generation-job and private-file rejection without Access, security headers and absence of source maps. Confirm exact-email Access Allow policy behavior for the owner and denial for an uninvited identity. Confirm that tracked production configuration reports generation disabled and rejects job creation before a D1 write. Do not print or record identities, tokens or deployment identifiers during validation.

The local generation milestone is not a provider-readiness check and must not be represented as real-provider, preview or production-generation evidence.
