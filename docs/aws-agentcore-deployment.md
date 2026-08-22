# AWS AgentCore deployment runbook

CreditBridge exposes an AgentCore-compatible HTTP runtime while keeping consequential academic decisions outside the model boundary.

## Execution modes

| Mode | External model call | Default | Purpose |
|---|---:|---:|---|
| `deterministic` | No | Yes | Reproducible judging, policy tests, and low-cost validation |
| `strands` | Amazon Bedrock | No | Synthetic document extraction and agent-orchestration demonstration |

Both modes require `synthetic: true`. The service rejects records not explicitly marked synthetic or de-identified. Neither path returns a final academic-credit decision.

## Local container verification

```bash
docker build -f infra/agentcore/Dockerfile -t creditbridge-agentcore .
docker run --rm -p 8080:8080 creditbridge-agentcore
```

Invoke it with a synthetic fixture:

```bash
curl -X POST http://localhost:8080/invocations \
  -H 'content-type: application/json' \
  -d '{"synthetic":true,"case_id":"CB-DEMO-0001","source_course":"DEMO CS 38","target_course":"DEMO CS 33","source_text":"Object-oriented design and data structures"}'
```

## Live Strands mode

Set all three variables deliberately in the AgentCore runtime configuration:

```text
CREDITBRIDGE_EXECUTION_MODE=strands
CREDITBRIDGE_ALLOW_LIVE_MODEL=true
BEDROCK_MODEL_ID=<approved Amazon Bedrock model ID>
```

Grant the runtime role only the selected model's required `bedrock:InvokeModel` permission. Do not grant broad administrator access. Keep live execution disabled until an explicit cost budget, model-data review, and synthetic test plan are approved.

Follow the current AWS AgentCore Runtime deployment flow rather than storing account identifiers, credentials, or generated deployment metadata in this repository. See the official [AgentCore Runtime quickstart](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/runtime-get-started-cli.html) and [Strands deployment guide](https://strandsagents.com/docs/user-guide/deploy/deploy_to_aws_lambda/).
