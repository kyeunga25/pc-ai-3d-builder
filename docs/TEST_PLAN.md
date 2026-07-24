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
- health response and public security headers.

## Migration check

Apply both migrations to an empty temporary SQLite database and confirm `PRAGMA foreign_key_check` returns no rows. Never use a local copy of production data.

## Browser check

Test the built application at desktop and tablet widths. Confirm:

- the authentication loading and failure states are readable;
- every navigation item is keyboard reachable;
- the builder route loads lazily;
- no horizontal overflow obscures primary actions;
- reduced-motion preferences disable non-essential animation;
- UI fixtures remain visibly synthetic.

## Deployment check

Use a Git-ignored deployment configuration. Verify the public health endpoint, static deep-link fallback, protected session rejection without Access, security headers and absence of source maps. Do not print or record deployment identifiers during validation.
