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
- atomic review and audit statement construction without identity data in metadata.

## Migration check

Apply all numbered migrations to an empty temporary SQLite database and confirm schema phase `6`, the catalogue record-version column, private asset-file metadata columns and no rows from `PRAGMA foreign_key_check`. Insert only synthetic workspace, catalogue and asset fixtures when checking relational constraints. Never use a local copy of production data.

## Browser check

Test the built application at desktop and tablet widths. Confirm:

- the authentication loading and failure states are readable;
- every navigation item is keyboard reachable;
- the builder route loads lazily;
- no horizontal overflow obscures primary actions;
- reduced-motion preferences disable non-essential animation;
- UI fixtures remain visibly synthetic.
- catalogue search filters the rendered synthetic records;
- catalogue create, edit and two-step archive actions update synthetic state;
- a valid synthetic CSV document imports records, while malformed or duplicate data shows a bounded error;
- a synthetic PNG creates a private asset draft from the catalogue;
- a synthetic GLB unlocks the manual Three.js preview and remains required for approval;
- desktop and 390 px layouts show source and model controls without page-level horizontal overflow;
- completing the final asset checklist item enables approval, and approval locks the reviewed fields.

## Deployment check

Use a Git-ignored deployment configuration. Verify the public health endpoint, static deep-link fallback, protected session rejection without Access, security headers and absence of source maps. Do not print or record deployment identifiers during validation.
