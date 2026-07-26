# Compatibility rules

RigStage evaluates compatibility only from structured catalogue fields whose record is marked `verified`. Visual meshes, model bounds, marketing images and inferred geometry are never inputs.

## Active rules

| Rule | Required categories | Verified fields | Result |
| --- | --- | --- | --- |
| CPU socket | CPU, motherboard | `socket`, `socket` | Exact normalized match; mismatch is an error. |
| Memory type | Memory, motherboard | `memoryType`, `memoryType` | Exact normalized match; mismatch is an error. |
| Motherboard form factor | Motherboard, case | `formFactor`, `supportedMotherboardFormFactors` | Case support is a comma, slash or pipe-separated list; mismatch is an error. |
| GPU clearance | GPU, case | `lengthMm`, `maxGpuLengthMm` | GPU length must be less than or equal to case clearance; failure is an error. |
| Cooler clearance | Cooling, case | `coolerHeightMm`, `maxCoolerHeightMm` | Cooler height must be less than or equal to case clearance; failure is an error. |
| GPU PSU recommendation | PSU, GPU | `capacityWatts`, `recommendedPsuWatts` | PSU capacity below the recorded recommendation is a warning. |

Each selected out-of-stock or archived record also produces a warning. These availability findings are separate from physical compatibility.

## Fail-closed behavior

A rule is `unknown` when a required component is not selected, either record is unverified, a required field is absent, or a numeric value is not positive. RigStage does not replace unknown data with defaults.

Portable export is available only when there are no `error` or `unknown` findings and the current browser changes have been saved. Warnings remain visible in the exported bilingual evidence.

## Export boundary

The portable JSON contains component category, SKU, manufacturer, model, verification status, verified specifications and compatibility findings. It excludes:

- user and workspace identity;
- internal build and catalogue identifiers;
- price and stock;
- private image and GLB metadata;
- R2 keys, checksums and provider data;
- Cloudflare deployment configuration.
