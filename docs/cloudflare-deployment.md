# Cloudflare production deployment

CreditBridge can run independently on Cloudflare Workers while preserving its
Next.js-compatible interface and D1 case ledger. Amazon Bedrock AgentCore
remains a separate AWS runtime and is not replaced by this deployment.

## Required GitHub Actions secrets

Configure these repository secrets before manually starting the
`Deploy Cloudflare` workflow:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `CREDITBRIDGE_D1_DATABASE_ID`

The Cloudflare token should be scoped to the target account and limited to
Workers Scripts edit and D1 edit permissions. Do not use a Global API Key.

## Release path

The workflow performs the same acceptance gates as CI, builds the Worker,
replaces the Sites-owned D1 placeholder with the external database ID, applies
the checked-in migrations, and publishes the Worker. Deployment is manual so a
missing or rotated secret cannot make the normal CI workflow fail.

## Local release commands

After authenticating Wrangler and setting `CREDITBRIDGE_D1_DATABASE_ID`:

```bash
npm ci
npm test
npm run cloudflare:prepare
npm run cloudflare:migrate
npm run cloudflare:publish
```

The generated external Wrangler configuration lives under `dist/` and is not
committed. `.openai/hosting.json` remains unchanged so the existing ChatGPT
Sites deployment stays recoverable during migration.
