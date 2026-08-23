import json
from typing import Any

from bedrock_agentcore.runtime import BedrockAgentCoreApp
from orchestrator import run_case

app = BedrockAgentCoreApp()


@app.entrypoint
def invoke(payload: dict[str, Any], context: Any = None) -> dict[str, Any]:
    """Process one evidence-grounded transfer-credit case."""
    if not isinstance(payload, dict):
        return {
            "status": "rejected",
            "error": "Payload must be a JSON object.",
        }

    prompt_payload = payload.get("prompt")
    if isinstance(prompt_payload, str):
        cleaned_prompt = prompt_payload.strip().lstrip("\ufeff")
        try:
            parsed_prompt = json.loads(cleaned_prompt)
            if isinstance(parsed_prompt, dict):
                payload = {**payload, **parsed_prompt}
        except json.JSONDecodeError:
            pass

    case_id = str(payload.get("case_id", "")).strip()
    source_bundle = str(
        payload.get("source_bundle") or payload.get("prompt") or ""
    ).strip()

    if not case_id:
        return {
            "status": "rejected",
            "error": "case_id is required.",
        }

    if not source_bundle:
        return {
            "status": "rejected",
            "case_id": case_id,
            "error": "source_bundle is required.",
        }

    if len(source_bundle) > 100_000:
        return {
            "status": "rejected",
            "case_id": case_id,
            "error": "source_bundle exceeds the 100,000 character limit.",
        }

    result = run_case(case_id=case_id, source_bundle=source_bundle)

    return {
        "status": "completed",
        **result,
    }

if __name__ == "__main__":
    app.run()
