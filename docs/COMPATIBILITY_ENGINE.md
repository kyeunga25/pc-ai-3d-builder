# Compatibility boundary

The current builder displays synthetic compatibility states for interface testing. A production compatibility engine is not active in this release.

Stable rules for any future implementation:

- Use structured, source-backed product specifications.
- Mark AI-extracted values as unverified until a human confirms them.
- Never infer sockets, connectors, wattage or physical clearance from a visual mesh.
- Evaluate hard errors and warnings deterministically on the server.
- Include the rule identifier and relevant input evidence in every result.
- Reject cross-workspace catalogue or build references.
- Keep UI hints separate from the server decision.
- Test each rule with compatible, incompatible, missing-data and boundary-value fixtures.

The repository does not include private scoring weights, commercial ranking targets or unpublished catalogue data.
