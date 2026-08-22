from __future__ import annotations

from strands import Agent

from .tools import extract_learning_outcomes, request_human_review, verify_document

INTAKE_PROMPT = """You are CreditBridge's Intake Agent. Normalize only user-supplied academic documents. Never infer missing grades, units, institutions, or course identities. Every extracted field must retain a source citation."""
EVIDENCE_PROMPT = """You are CreditBridge's Evidence Agent. Build a source-grounded map of course learning outcomes. Distinguish quotations from inferences and reject uncited claims."""
MATCHING_PROMPT = """You are CreditBridge's Matching Agent. Compare learning outcomes, assessment depth, contact hours, prerequisites, and lab requirements. Return structured candidates, not academic decisions."""
POLICY_PROMPT = """You are CreditBridge's Policy Agent. Apply explicit institutional thresholds. Missing evidence, contradictions, low confidence, or material lab differences must route to human review. Never award credit."""
PACKET_PROMPT = """You are CreditBridge's Packet Agent. Assemble cited evidence and prior outputs into a review packet. Do not change scores or create unsupported facts."""


def build_agents() -> dict[str, Agent]:
    return {
        "intake": Agent(name="intake_agent", description="Normalizes academic records", system_prompt=INTAKE_PROMPT, tools=[verify_document, extract_learning_outcomes], callback_handler=None),
        "evidence": Agent(name="evidence_agent", description="Builds cited outcome evidence", system_prompt=EVIDENCE_PROMPT, callback_handler=None),
        "matching": Agent(name="matching_agent", description="Computes course alignment candidates", system_prompt=MATCHING_PROMPT, callback_handler=None),
        "policy": Agent(name="policy_agent", description="Enforces decision boundaries", system_prompt=POLICY_PROMPT, tools=[request_human_review], callback_handler=None),
        "packet": Agent(name="packet_agent", description="Builds the advisor packet", system_prompt=PACKET_PROMPT, callback_handler=None),
    }


def run_case(case_id: str, source_bundle: str) -> dict:
    agents = build_agents()
    context = f"Case {case_id}\nSubmitted source bundle:\n{source_bundle}"
    intake = str(agents["intake"](context))
    evidence = str(agents["evidence"](f"Case {case_id}\nVerified intake:\n{intake}"))
    matching = str(agents["matching"](f"Case {case_id}\nCited evidence:\n{evidence}"))
    policy = str(agents["policy"](f"Case {case_id}\nCandidate comparison:\n{matching}"))
    packet = str(agents["packet"](f"Case {case_id}\nIntake:\n{intake}\nEvidence:\n{evidence}\nMatch:\n{matching}\nPolicy:\n{policy}"))
    return {"case_id": case_id, "intake": intake, "evidence": evidence, "matching": matching, "policy": policy, "packet": packet}
