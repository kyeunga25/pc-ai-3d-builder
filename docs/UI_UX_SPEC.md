# Interface specification

## Language and accessibility

- Traditional Chinese for Hong Kong is the primary interface language.
- Dashboard headings, primary actions, operational metrics, recent work and readiness guidance show Traditional Chinese first with a smaller visible English companion; proper workspace and product names are not machine-translated.
- Text and numerical values must remain readable on the dark surface palette.
- Controls require visible keyboard focus and accessible labels.
- Status must not depend on colour alone.
- Non-essential motion must respect `prefers-reduced-motion`.

The login page presents Traditional Chinese above supporting English for its introduction, identity and active-membership boundaries, all five status reasons, fixed workspace destination, Access continuation, unauthorized-identity logout, public-home recovery and fail-closed footer. Accessible names contain both languages. It shows only a generic route destination, never a dynamic record identifier. At 390 px, supporting English, destination labels and full-width actions wrap without horizontal overflow; this guidance never implies that the client has granted workspace access.

The public landing header, hero, primary actions, proof points, three workflow narratives, three merchant use cases, all four synthetic screenshot alternatives/captions, trust boundaries, invited sign-in section and footer present Traditional Chinese above supporting English. Workflow labels retain their numbered sequence, each evidence point preserves the same semantic list structure, navigation and action names are bilingual, links remain same-origin or local, and the screenshot boundary states that visual material is not compatibility evidence. At 390 px, supporting English, numbered labels, captions and actions wrap without page-level horizontal overflow; reduced-motion preferences continue to suppress entrance animations.

## Layout

The application shell uses a top command bar and merchant navigation. The builder keeps its central viewport as the primary area, with component selection, inspection and build status surrounding it.

The Catalogue list shows page guidance, actions, search, category and verification filters, columns, category, stock, asset state, quality, quantity and row actions in Traditional Chinese and English. Unknown stock is not presented as available; status uses text and icons in addition to colour. Viewer write actions stay disabled. At compact widths, page actions and live status wrap, filters can move to separate rows and the simplified product row retains a bilingual accessible View action without page-level horizontal overflow.

The Catalogue editor presents create, edit and read-only view modes with Traditional Chinese above supporting English for its context, fields, options, specification guidance and operation states. Visible labels remain associated with their controls. Viewer mode keeps the fieldset disabled and omits save, archive and source-draft actions while retaining review and close navigation. At 390 px, the two-column form becomes one column and bilingual action labels wrap inside full-width controls without exposing private part or asset identifiers.

The Builder command bar presents workspace and current-build context, editable build name, Dashboard navigation, build creation, two-step archive and inspector access in Traditional Chinese and English. Fixed labels wrap rather than clipping; viewer mode omits write controls. At compact widths the inspector text may be visually hidden, but the icon keeps its complete bilingual accessible name.

At narrower widths, the inspector becomes a labelled modal overlay and the component rail becomes a compact step bar. Opening the drawer moves focus to its close control, Tab and Shift+Tab stay within its controls, Escape or either close surface dismisses it, background scrolling pauses and focus returns to the opener. Primary actions must remain visible without horizontal scrolling.

The Builder inspector shows its tabs, selected-component summary, structured specifications, rule findings and 3D asset state in Traditional Chinese and English. Pass, warning, error and unknown states use text and icons in addition to colour; an approved visual asset remains explicitly separate from compatibility evidence. Bilingual tab labels, stock counts, values and pill badges wrap inside the narrow overlay instead of clipping or creating page-level horizontal overflow.

The Builder viewport shows camera presets, display modes, fit-view control, scene readouts, selected component, stock state and model provenance in Traditional Chinese and English. Authorized private loading, local synthetic preparation, load failure and static fallback remain visibly distinct. The footer uses content-driven height and wrapping for preview provenance, the visual-evidence limitation and scene units; compact widths may hide secondary controls but retain bilingual accessible names.

The Builder component rail shows all categories, step state, candidate count, stock state, current selection and persistence guidance in Traditional Chinese and English. Error, unknown, warning, pending and complete states use accessible text as well as the existing shape or colour. Desktop rows grow for bilingual labels; the compact step bar keeps bilingual short labels and a bilingual accessible state while hiding secondary status text. Low stock, unknown stock and out of stock remain visually distinct, and the rail scrolls internally instead of causing page-level overflow.

The Builder status bar shows compatibility, selected-component count, workspace total and Save/Export in Traditional Chinese and English. Compatibility uses error, unknown, warning and success text plus distinct icons and semantic colour, in that fail-closed priority order. Bilingual values wrap instead of truncating; compact icon-only actions retain complete accessible names. The export title distinguishes ready and blocked states and states that the portable file excludes identity, pricing, stock and private assets.

## States

Every data-dependent screen must represent loading, empty and error states. Synthetic demo values must be visibly distinguishable from verified merchant data.

Asset status uses explicit text labels. A draft cannot be presented as approved. Compatibility errors, warnings and information use separate icons and text in addition to colour.

Every approval-check and verified-dimension label is shown in Traditional Chinese and English, together with explicit human-verification guidance and an authoritative bilingual completion count. Inputs remain wrapped by their visible labels. The three-column dimension grid uses zero-minimum tracks and becomes one column at 480 px or narrower so bilingual copy and numeric values do not create horizontal overflow.

Private source-image and GLB controls show Traditional Chinese and English requirements, upload/replace/progress actions and the Access boundary without exposing an asset identifier. Replacing a file visibly warns that the checklist and verified dimensions reset, only the selected file is superseded and the other private file remains private. At narrow widths, labels and controls wrap into a vertical layout without horizontal overflow.

The source filmstrip labels each canonical view, authorized or missing private-image state, real preview and placeholder, and confirmed or missing usage-rights evidence in both languages. Rights state uses an icon and text in addition to success or warning colour. At phone width, bilingual view badges stay bounded inside each thumbnail while the filmstrip remains an internally scrollable row.

The Asset Review viewport shows each camera preset, tool accessibility name, selected-camera readout, private-model state and visual-evidence limitation in both languages. Its footer uses content-driven height and wrapping instead of clipping bilingual text. Shared private-GLB loading and decode-failure overlays remain centred, bounded to the viewport and readable without exposing parser detail.

The Asset Review header and metadata inspector show the draft lifecycle state, source kind, quality, version and queue context in Traditional Chinese and English without displaying an internal asset ID. English queue counts use the correct singular or plural form. The pill-shaped status badge grows to two lines at narrow widths instead of clipping either language.

Generation status uses provider-neutral queued, running, validating, waiting-for-review, failed and cancelled labels. Simulation must be identified as zero-cost synthetic validation and never described as AI or professional provider output. A disabled production capability remains visibly disabled with an explanatory title.

The generation action is available only to owner/admin roles after a private source image and saved usage-rights confirmation exist with no unsaved review changes. A completed job reloads the new draft version and visibly resets every approval check and dimension.

The production dashboard must use protected workspace data and must not present fixed catalogue, review, timing or readiness claims. Metric and readiness counts preserve their authoritative numeric value while bilingual labels handle English singular/plural forms. At narrow widths, the recent-work badge may become icon-led but its bilingual text remains accessible, and no Dashboard copy may create page-level horizontal overflow. Controls without an available model or permitted action remain visibly disabled. Logical archive requires a separate confirmation action and never masquerades as permanent deletion.

## Performance

The builder route is lazy-loaded. UI navigation must remain usable before any 3D code or private asset is available. Three.js loads only when a protected GLB is decoded. A static placeholder remains available when no approved model has loaded.

## Visual tokens

The implemented CSS variables in `src/shared/design-system/global.css` are the source of truth for colours, spacing, borders, focus treatment and motion. This document intentionally avoids private reference material and unpublished design rationale.
