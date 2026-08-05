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
- exact protected SPA parent/deep-route matching and Static Assets Worker-first configuration;
- AJAX expiry signaling and top-level re-login/logout paths;
- workspace membership selection and tampering rejection;
- concurrent first-login subject binding;
- subject-keyed API rate limiting;
- read-only session responses;
- audit helper serialization;
- health response and public security headers;
- bounded, workspace-scoped catalogue pagination and filters;
- catalogue writer role checks, SKU conflicts, optimistic versions and logical archive;
- strict CSV parsing and transactional imports of at most 50 catalogue records;
- image and GLB signature, MIME, size and length validation;
- workspace-scoped private R2 creation, replacement, rollback cleanup and reads;
- GLB-required approval and review reset after file replacement;
- bounded JSON mutation bodies;
- asset-review role checks, complete-approval requirements and stale-version rejection;
- atomic review and audit statement construction without identity data in metadata;
- deterministic build compatibility pass, warning, error and unknown outcomes;
- workspace-scoped build list, role checks, guarded optimistic mutations and portable export;
- export exclusion of build/workspace identity, price, stock and private-asset fields;
- read-only workspace dashboard aggregates, empty state and identity exclusion;
- guarded logical archive for a build draft.
- generation capability fail-closed parsing and disabled-provider behavior;
- runtime synthetic GLB structure and existing self-contained-model validation;
- owner/admin generation role checks, saved source-rights requirement and current review version;
- workspace-scoped generation job listing without private object or Workflow data;
- idempotent, zero-cost job creation before Workflow start, including rejection of cross-asset key reuse;
- payment provider boundary remaining disconnected and disabled.
- private owner-onboarding input validation, idempotent owner/workspace SQL and optional bounded credit-account creation.

## Migration check

Apply all numbered migrations to an empty temporary SQLite database and confirm schema phase `8`, the catalogue record-version column, private asset-file metadata columns, `builds`, `build_items`, `generation_jobs` and `generation_job_events`, and no rows from `PRAGMA foreign_key_check`. Confirm that duplicate workspace idempotency keys and concurrent active jobs for one asset are rejected. Insert only synthetic workspace, catalogue, asset, generation-job and build fixtures when checking relational constraints. Never use a local copy of production data.

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
- local preview requires a saved source-rights confirmation before enabling zero-cost simulation;
- local simulation creates a runtime synthetic GLB, marks the job waiting for review, resets all checklist/dimension evidence and never labels the output approved;
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
