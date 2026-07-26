## Summary

<!-- Describe the implemented change and its user-visible impact. Do not include confidential business context. -->

## Validation

- [ ] `npm run check`
- [ ] `npm run test`
- [ ] `npm run build`
- [ ] `npm run cf:dry-run`
- [ ] `npm audit --audit-level=high`

## Safety checklist

- [ ] Protected records remain scoped to a verified workspace membership.
- [ ] Failure, loading and permission states are represented.
- [ ] Tests and screenshots use synthetic fixtures only.
- [ ] The diff contains no credentials, personal data, deployment identifiers, actual resource names, private URLs, generated models or production records.
- [ ] D1 schema changes use a numbered migration.
- [ ] Documentation describes implemented public behavior only.
