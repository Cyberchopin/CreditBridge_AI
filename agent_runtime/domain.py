from __future__ import annotations

from dataclasses import asdict, dataclass
from hashlib import sha256
from json import dumps
from typing import Literal

Decision = Literal["auto_recommend", "human_review", "insufficient_evidence"]


@dataclass(frozen=True)
class OutcomeMatch:
    source_outcome: str
    target_outcome: str
    score: float
    source_citation: str


@dataclass(frozen=True)
class Evaluation:
    case_id: str
    source_course: str
    target_course: str
    matches: tuple[OutcomeMatch, ...]
    required_outcomes: int
    policy_version: str = "2.4"

    @property
    def coverage(self) -> float:
        return sum(item.score for item in self.matches) / self.required_outcomes


@dataclass(frozen=True)
class PolicyResult:
    decision: Decision
    confidence: float
    reasons: tuple[str, ...]
    requires_human: bool


def evaluate_policy(evaluation: Evaluation) -> PolicyResult:
    if len(evaluation.matches) < evaluation.required_outcomes:
        return PolicyResult(
            decision="insufficient_evidence",
            confidence=round(evaluation.coverage, 3),
            reasons=("One or more required outcomes have no cited evidence.",),
            requires_human=True,
        )
    weak = tuple(match for match in evaluation.matches if match.score < 0.70)
    if weak or evaluation.coverage < 0.90:
        reason = "Material outcome ambiguity requires academic judgment."
        return PolicyResult("human_review", round(evaluation.coverage, 3), (reason,), True)
    return PolicyResult("auto_recommend", round(evaluation.coverage, 3), ("All policy thresholds satisfied.",), False)


def append_receipt(previous_hash: str, actor: str, action: str, payload: dict) -> dict:
    canonical = dumps({"previous_hash": previous_hash, "actor": actor, "action": action, "payload": payload}, sort_keys=True, separators=(",", ":"))
    return {"actor": actor, "action": action, "payload": payload, "previous_hash": previous_hash, "event_hash": sha256(canonical.encode()).hexdigest()}


def result_payload(result: PolicyResult) -> dict:
    return asdict(result)
