# Interface specification

## Language and accessibility

- Traditional Chinese for Hong Kong is the primary interface language.
- Text and numerical values must remain readable on the dark surface palette.
- Controls require visible keyboard focus and accessible labels.
- Status must not depend on colour alone.
- Non-essential motion must respect `prefers-reduced-motion`.

## Layout

The application shell uses a top command bar and merchant navigation. The builder keeps its central viewport as the primary area, with component selection, inspection and build status surrounding it.

At narrower widths, the inspector becomes an overlay and the component rail becomes a compact step bar. Primary actions must remain visible without horizontal scrolling.

## States

Every data-dependent screen must represent loading, empty and error states. Synthetic demo values must be visibly distinguishable from verified merchant data.

Asset status uses explicit text labels. A draft cannot be presented as approved. Compatibility errors, warnings and information use separate icons and text in addition to colour.

## Performance

The builder route is lazy-loaded. UI navigation must remain usable before any 3D code or private asset is available. A static placeholder remains available when no approved model has loaded.

## Visual tokens

The implemented CSS variables in `src/shared/design-system/global.css` are the source of truth for colours, spacing, borders, focus treatment and motion. This document intentionally avoids private reference material and unpublished design rationale.
