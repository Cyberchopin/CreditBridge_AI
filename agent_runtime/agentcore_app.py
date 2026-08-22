from __future__ import annotations

import os
from typing import Any

from bedrock_agentcore import BedrockAgentCoreApp
from strands.models import BedrockModel

from .demo_service import analyze_deterministically, parse_request
from .orchestrator import run_case

app = BedrockAgentCoreApp()


def _enabled(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in {"1", "true", "yes"}


def invoke(payload: dict[str, Any]) -> dict[str, Any]:
    request = parse_request(payload)
    mode = os.getenv("CREDITBRIDGE_EXECUTION_MODE", "deterministic").strip().lower()
    if mode == "deterministic":
        return analyze_deterministically(request)
    if mode != "strands":
        raise ValueError("CREDITBRIDGE_EXECUTION_MODE must be deterministic or strands")
    if not _enabled("CREDITBRIDGE_ALLOW_LIVE_MODEL"):
        raise PermissionError("Live model execution is disabled. Set CREDITBRIDGE_ALLOW_LIVE_MODEL=true explicitly.")
    model_id = os.getenv("BEDROCK_MODEL_ID", "").strip()
    if not model_id:
        raise ValueError("BEDROCK_MODEL_ID is required for live Strands execution")
    model = BedrockModel(model_id=model_id, region_name=os.getenv("AWS_REGION", "us-east-1"))
    output = run_case(request.case_id, request.source_text, model)
    return {
        **output,
        "synthetic": True,
        "execution_mode": "strands",
        "final_credit_decision": None,
        "authority_required": "authorized academic reviewer",
    }


@app.entrypoint
def entrypoint(payload: dict[str, Any]) -> dict[str, Any]:
    try:
        return invoke(payload)
    except (ValueError, PermissionError) as error:
        return {"error": str(error), "final_credit_decision": None}


if __name__ == "__main__":
    app.run()
