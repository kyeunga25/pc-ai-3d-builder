# Contribution workflow

This repository contains only public product documentation, source code and synthetic fixtures.

Before changing code:

1. Read `AGENTS.md`, `README.md` and `SECURITY.md`.
2. Run `git status -sb` and preserve unrelated work.
3. Keep real Cloudflare identifiers, credentials, user records and private assets outside Git.
4. Use synthetic fixtures in tests and screenshots.
5. Keep protected records scoped to the verified workspace on the server.

Before handing off:

```bash
npm run check
npm run test
npm run build
npm run cf:dry-run
npm audit --audit-level=high
```

Review the staged diff explicitly. Do not stage local deployment configuration, Wrangler metadata, database files, generated models, logs or source maps.

Use the repository issue forms for public-safe bug reports and bounded feature suggestions. Use the Security tab for vulnerabilities. Never place credentials, personal data, production records, actual resource names, private URLs or confidential business information in issues or pull requests.
