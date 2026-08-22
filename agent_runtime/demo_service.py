from __future__ import annotations

from dataclasses import asdict, dataclass
from hashlib import sha256
from typing import Any

from .domain import Evaluation, OutcomeMatch, append_receipt, evaluate_policy, result_payload

MAX_SOURCE_CHARS = 50_000
DEFAULT_SOURCE = """Object-oriented design
Data structures and algorithms
Memory models and machine representation
Java programming laboratory"""


@dataclass(frozen=True)
class DemoRequest:
    case_id: str
    source_course: str
    target_course: str
    source_text: str
    synthetic: bool


def _bounded(value: Any, fallback: str, length: int) -> str:
    return value.strip()[:length] if isinstance(value, str) and value.strip() else fallback


def parse_request(payload: dict[str, Any]) -> DemoRequest:
    if payload.get("synthetic") is not True:
        raise ValueError("Only synthetic or de-identified demonstration records are accepted.")
    source_text = payload.get("source_text", DEFAULT_SOURCE)
    if not isinstance(source_text, str):
        raise ValueError("source_text must be a string")
    if len(source_text) > MAX_SOURCE_CHARS:
        raise ValueError(f"source_text exceeds {MAX_SOURCE_CHARS} characters")
    return DemoRequest(
        case_id=_bounded(payload.get("case_id"), "CB-DEMO-0001", 64),
        source_course=_bounded(payload.get("source_course"), "DEMO CS 38", 80),
        target_course=_bounded(payload.get("target_course"), "DEMO CS 33", 80),
        source_text=source_text,
        synthetic=True,
    )


def _score(text: str, terms: tuple[str, ...], positive: float, negative: float) -> float:
    normalized = text.lower()
    return positive if any(term in normalized for term in terms) else negative


def analyze_deterministically(request: DemoRequest) -> dict[str, Any]:
    definitions = (
        ("Object-oriented design", ("object-oriented", "object oriented", "oop"), 0.96, 0.58, "source#object-oriented-design"),
        ("Data structures and algorithms", ("data structure", "algorithm"), 0.93, 0.55, "source#data-structures"),
        ("Memory and machine representation", ("memory", "machine representation", "computer organization"), 0.82, 0.49, "source#memory"),
        ("Assembly programming laboratory", ("assembly lab", "assembly-language laboratory", "mips lab"), 0.91, 0.42, "source#laboratory"),
    )
    matches = tuple(
        OutcomeMatch(label, label, _score(request.source_text, terms, positive, negative), citation)
        for label, terms, positive, negative, citation in definitions
    )
    evaluation = Evaluation(request.case_id, request.source_course, request.target_course, matches, len(definitions))
    policy = evaluate_policy(evaluation)
    genesis = sha256(request.source_text.encode()).hexdigest()
    receipt = append_receipt(genesis, "policy_kernel", "evaluated_case", result_payload(policy))
    return {
        "case_id": request.case_id,
        "source_course": request.source_course,
        "target_course": request.target_course,
        "synthetic": True,
        "execution_mode": "deterministic",
        "document_hash": genesis,
        "matches": [asdict(match) for match in matches],
        "policy": result_payload(policy),
        "receipt": receipt,
        "final_credit_decision": None,
        "authority_required": "authorized academic reviewer",
    }
