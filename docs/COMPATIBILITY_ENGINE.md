# Compatibility boundary

RigStage v1.0 evaluates compatibility from current workspace catalogue records at build read time. Six deterministic rules are active for CPU socket, memory type, motherboard form factor, GPU clearance, cooler clearance and the recorded GPU power-supply recommendation.

The complete field mapping, severities and export behavior are documented in [COMPATIBILITY_RULES.md](COMPATIBILITY_RULES.md).

Stable boundaries:

- Use only structured specifications marked `verified`.
- Never infer sockets, connectors, wattage or physical clearance from a visual mesh.
- Return `unknown` when a required selection, verification state or field is missing.
- Include a stable rule identifier and bilingual evidence in every evaluated result.
- Reject cross-workspace catalogue or build references.
- Block portable export on `error` or `unknown`; retain explicit warnings.
- Test compatible, incompatible, missing-data and boundary-value fixtures.

The repository does not include private scoring weights, commercial ranking targets or unpublished catalogue data.
