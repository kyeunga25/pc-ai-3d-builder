# Product behavior

RigStage is an invite-only browser workspace for computer merchants. Version 1.1 provides a usable human-reviewed workflow from workspace catalogue onboarding and private visual assets to persistent PC builds, deterministic compatibility evidence and privacy-bounded export. It also includes a fail-closed generation-job foundation whose only implemented adapter is a zero-cost synthetic simulation.

## Implemented behavior

- Traditional Chinese interface with HKD formatting.
- Traditional-Chinese-first bilingual public entry covering header navigation, hero value proposition, primary actions, three proof points, three evidence-based workflow narratives, three merchant use cases, four synthetic workspace screenshot alternatives and captions, four privacy/accuracy trust boundaries and invited sign-in recovery. Public links remain same-origin or tracked local assets, and compact copy wraps without implying that visual material proves compatibility.
- Workspace-scoped session resolution through Cloudflare Access and D1.
- Traditional-Chinese-first bilingual login workflow covering the introduction, five fail-closed identity states, security boundaries, generic workspace destinations, Access continuation, unauthorized-identity logout and public-home recovery. Public return targets are limited to four fixed roots and omit dynamic identifiers; compact copy wraps without changing server authorization.
- Live workspace dashboard plus catalogue, asset review and builder routes.
- Bounded, read-only dashboard aggregates with recent review and build work, including Traditional-Chinese-first bilingual page actions, metric/readiness summaries, schema-required work details, lifecycle labels and relative update times.
- Bounded catalogue pagination and review-queue reads from the resolved workspace.
- Traditional-Chinese-first bilingual Catalogue list for page guidance, actions, search, category and verification filters, table columns, all nine component categories, every stock/asset/quality state, correct English stock-count grammar and privacy-safe row actions. Viewer mutations stay disabled and compact copy wraps without exposing part or asset IDs.
- Traditional-Chinese-first bilingual Catalogue editor for create, edit and view modes, including record version, all fields, exhaustive category and stock options, specification-verification choices, JSON guidance and archive/upload/save progress. Viewer mode disables the complete field set and omits mutation controls; compact copy wraps without exposing part or asset IDs.
- Role-protected catalogue creation, optimistic updates and logical archive.
- Validated CSV template download and transactional import of at most 50 catalogue records.
- Traditional-Chinese-first bilingual Catalogue status and recovery copy for product writes, two-step archive, private asset-draft creation and CSV import, including semantic info/success/warning/error announcements and reload guidance after an ambiguous write result.
- Draft saves for staff, with approval and rejection reserved for owner or admin roles.
- Traditional-Chinese-first bilingual Asset Review progress, success, unsaved-warning and failure announcements for draft save, approval, rejection, private-file upload, exact private-file removal, simulated generation and queued-job cancellation, including reload guidance when a response is lost after a possible write.
- Domain-complete Traditional-Chinese-first bilingual labels for all six approval checks and three verified dimensions, human-verification guidance and a completion count with correct English singular/plural handling.
- Exhaustive Traditional-Chinese-first bilingual Asset Review header and metadata labels for every draft/in-review/approved/rejected status, source kind and quality value, plus version and queue context with correct English singular/plural and no visible internal asset ID.
- Two-step Asset Review rejection scoped to the current workspace and asset version, with a bilingual warning that reserved credit may be released but private files are not deleted; form, file, generation, workspace or version changes disarm confirmation before submission.
- Optimistic asset versions and append-only review and audit events.
- Four private source-image views (`front`, `back`, `left`, `three-quarter`) plus one GLB, with signature, MIME and size validation, safe per-slot metadata, Traditional-Chinese-first bilingual requirements, selectable upload/replace/remove/progress controls and Access-boundary guidance. Replacement or removal warns that all approval evidence is reset and every other private file remains private. Removal requires a second activation for the unchanged workspace, asset version, kind and selected view before the Worker receives a bodyless request.
- Authorized private-file reads and manual Three.js GLB inspection without permanent object URLs.
- Traditional-Chinese-first bilingual Asset Review viewport labels for all four camera presets, fit/wireframe tools, selected-camera readout, authorized or missing model state, lazy-load/decode failures and the explicit boundary that visual material is not compatibility evidence.
- Traditional-Chinese-first bilingual source filmstrip with four selectable canonical view labels, authorized or missing private-image state, bounded preview alternative text, actionable missing-view accessibility names and distinct confirmed/missing usage-rights evidence. Only `front` may enter the generation boundary; the other views remain manual-review evidence.
- Explicit build creation, switching and optimistic persistence for one selected part per category.
- Two-step logical archive for build drafts.
- Traditional-Chinese-first bilingual status and recovery copy for build creation, switching, saving, archiving and privacy-safe export, with semantic info/success/warning/error announcements and safe fallbacks for monolingual technical failures.
- Traditional-Chinese-first bilingual Builder command bar for workspace/build context, Dashboard navigation, build naming, creation, two-stage archive and responsive inspector access. Viewer write controls stay absent, compact controls remain accessibly named and visible context uses display names rather than private IDs.
- Responsive Builder inspector modal with bilingual title and close controls, labelled dialog semantics, initial/final focus handling, contained Tab navigation, Escape and backdrop close, background scroll locking and no additional data operation.
- Deterministic compatibility findings from six verified structured-specification rules.
- Traditional-Chinese-first bilingual Builder inspector for all tabs, empty guidance, known specification fields, verification states, finding severity and evidence, plus exhaustive asset-status and quality labels. Unknown custom fields retain their bounded source key without semantic guessing, and no private asset ID is shown.
- Traditional-Chinese-first bilingual Builder component rail for all nine categories and summary, state precedence, candidate and selection counts, four stock states, empty guidance and the explicit-save boundary. Viewers remain unable to choose candidates, and private part or asset IDs are not displayed.
- Traditional-Chinese-first bilingual Builder status bar for compatibility, selected-component count, workspace total, Save and Export. Error, unknown, warning and success keep fail-closed precedence and semantic icons; count grammar, wrapping, compact accessible names and privacy-bounded export guidance are explicit.
- Protected preview of the selected component's approved GLB in the builder.
- Traditional-Chinese-first bilingual Builder viewport controls, camera/mode readouts, selected-component summary, stock and category states, private/local/fallback model states and a wrapping evidence-boundary footer. Loading failures remain generic and expose no private identifier or parser detail.
- Portable JSON export that fails closed and excludes identity, operational and private-asset fields.
- Clear draft, review and approved labels for visual assets.
- Human approval remains mandatory before generated material is treated as usable.
- Workspace-scoped, owner/admin-only generation requests with saved source-rights confirmation, optimistic asset versions and idempotency keys.
- Durable queued, running, validating, review-ready, failed and cancelled generation states with bounded job history.
- Owner/admin-only two-step cancellation of one exact still-queued job through a bodyless fixed API. The reservation is released only if cancellation wins before Workflow claim; started work returns a conflict and is not presented as stopped.
- Traditional-Chinese-first bilingual generation-inspector labels for every mode, job lifecycle and entitlement state, plus explicit non-monetary credit summaries and readable absent-value states without exposing provider or private-object details.
- Shared-schema and D1 enforcement that public generation failure/validation codes contain only 1–128 uppercase ASCII letters, digits or underscores, preventing arbitrary internal text from entering the response or review interface.
- Runtime synthetic GLB creation, private R2 storage, read-back validation and atomic review-version reset for local or explicitly controlled simulation testing.
- A tracked production kill switch that rejects generation before database writes or provider activity.

## Boundaries

- The application is not CAD, thermal simulation or mechanical validation software.
- A visual mesh never establishes compatibility.
- Prices, inventory and components shown in local development are fictional.
- No public marketplace, payment flow or customer-data collection is enabled.
- The runtime synthetic adapter validates orchestration only; it is not AI or a professional 3D-generation capability.
- External provider generation and multi-model 3D scene composition are optional future integrations, not v1.1 product capabilities.
- No checkout, invoice, subscription, payment webhook or payment ledger is enabled. The public payment interface remains disconnected and disabled.

## Data handling

Protected data must remain scoped to one verified workspace. Provider secrets and Cloudflare deployment identifiers stay in platform secrets or Git-ignored local configuration. Original images, generated models and render outputs must remain private until an authorized server path grants temporary access.
