# Payment boundary

RigStage does not currently provide checkout, invoices, subscriptions, payment webhooks or a payment ledger. The public code contains only a provider-neutral interface whose sole adapter fails closed with `PAYMENT_DISABLED`; it is not connected to an HTTP route, browser control or Cloudflare binding.

## Product boundary

- Access invitation follows contact, qualification and controlled onboarding; there is no public registration or self-service purchase flow.
- A successful redirect, client query, screenshot, generation result or asset approval cannot establish payment state.
- Customers would pay for agreed delivery or service milestones, not raw provider attempts.
- Real customer, merchant, order, payment, refund and dispute data must not enter fixtures, tests, screenshots or the public repository.

## Required gate before implementation

Payment work remains planning-only until written due diligence confirms supported domains, methods, fees, settlement, webhook behavior, PCI responsibility, data processing terms, service commitments and network restrictions. A sandbox phase must then cover success, failure, pending, duplicate, replayed, out-of-order, expired, refund and dispute events.

Only verified webhook signatures or an authenticated server-to-server status query may update a future ledger. Event, order and reference identifiers must be unique and idempotent. Browser redirects remain presentation only.

## Public/private source split

The public repository may retain generic types, synthetic fixtures and a disabled adapter. Any provider dependency, signature implementation, merchant mapping, live endpoint or privileged credential belongs in a minimal private server boundary after explicit approval.

The browser must never receive a merchant credential, provider-authenticated request, private signing key or payment secret. A future RigStage Worker may call the private boundary only through a generic service binding or authenticated server-to-server contract whose deployment target remains outside tracked configuration.
