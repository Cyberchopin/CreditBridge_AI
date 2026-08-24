# Cloudflare to AgentCore production link

The public Worker can invoke exactly one Amazon Bedrock AgentCore Runtime with an AWS Signature Version 4 request. The integration is disabled until all required Worker secrets are present.

## Security boundary

Create a dedicated IAM principal named `creditbridge-cloudflare-invoker`. Do not reuse the deployment principal or root credentials. Attach only this policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "InvokeCreditBridgeRuntimeOnly",
      "Effect": "Allow",
      "Action": "bedrock-agentcore:InvokeAgentRuntime",
      "Resource": "arn:aws:bedrock-agentcore:us-east-1:493233836205:runtime/CreditBridge_CreditBridgeCloudAgent-yrQQYmFDwc"
    }
  ]
}
```

Create one access key for that principal. Never paste either credential into source code, GitHub, an issue, or chat.

## Worker secrets

Prepare the generated deployment configuration, then enter each value interactively so it does not appear in PowerShell history:

```powershell
$env:CREDITBRIDGE_D1_DATABASE_ID = "dbce1cb5-9507-468a-8e6c-0b2e9b1867e9"
npm run cloudflare:prepare

npx wrangler secret put AGENTCORE_AWS_ACCESS_KEY_ID --config .\dist\server\wrangler.external.json
npx wrangler secret put AGENTCORE_AWS_SECRET_ACCESS_KEY --config .\dist\server\wrangler.external.json
npx wrangler secret put AGENTCORE_RUNTIME_ARN --config .\dist\server\wrangler.external.json
npx wrangler secret put AGENTCORE_LIVE_ENABLED --config .\dist\server\wrangler.external.json
```

Use the deployed runtime ARN above for `AGENTCORE_RUNTIME_ARN` and `true` for `AGENTCORE_LIVE_ENABLED`. Add `AGENTCORE_AWS_SESSION_TOKEN` only when using temporary credentials.

Apply the new D1 migration before deploying:

```powershell
npm run cloudflare:migrate
npm run cloudflare:publish
```

## Runtime controls

- Only requests explicitly marked synthetic are accepted.
- The public live path is limited to the built-in synthetic fixture.
- A successful execution is cached for 15 minutes.
- At most 12 new live invocations are recorded per UTC day.
- The UI exposes execution mode, runtime, region, duration, trace ID, and response hash.
- Missing credentials, quota exhaustion, AWS errors, and timeouts visibly fall back to the deterministic policy kernel.
- The runtime response never grants or denies academic credit; a human decision is still required.

## Verification

1. Open the production demo and select **Run agents** without uploading custom text.
2. Confirm the execution card says **Live AgentCore execution** or **Verified AgentCore receipt**.
3. Capture the trace ID and response hash shown in the interface.
4. In AWS, correlate the invocation timestamp and trace in AgentCore/CloudWatch.
5. Approve or escalate the case and open **Audit trail**. The final row must be `Authorized Advisor` with control `Human decision`.

If the execution card says **Deterministic safety path**, read its reason; do not present that run as live AgentCore evidence.
