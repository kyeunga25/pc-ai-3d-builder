# Interface specification

## Language and accessibility

- Traditional Chinese for Hong Kong is the primary interface language.
- Dashboard headings, primary actions, operational metrics, recent work and readiness guidance show Traditional Chinese first with a smaller visible English companion; proper workspace and product names are not machine-translated.
- Text and numerical values must remain readable on the dark surface palette.
- Controls require visible keyboard focus and accessible labels.
- Status must not depend on colour alone.
- Non-essential motion must respect `prefers-reduced-motion`.

## Layout

The application shell uses a top command bar and merchant navigation. The builder keeps its central viewport as the primary area, with component selection, inspection and build status surrounding it.

At narrower widths, the inspector becomes an overlay and the component rail becomes a compact step bar. Primary actions must remain visible without horizontal scrolling.

The Builder inspector shows its tabs, selected-component summary, structured specifications, rule findings and 3D asset state in Traditional Chinese and English. Pass, warning, error and unknown states use text and icons in addition to colour; an approved visual asset remains explicitly separate from compatibility evidence. Bilingual tab labels, stock counts, values and pill badges wrap inside the narrow overlay instead of clipping or creating page-level horizontal overflow.

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
