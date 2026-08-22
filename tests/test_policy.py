import unittest

from agent_runtime.domain import Evaluation, OutcomeMatch, append_receipt, evaluate_policy


def match(name: str, score: float) -> OutcomeMatch:
    return OutcomeMatch(name, name, score, f"syllabus.pdf#outcome-{name}")


class PolicyTests(unittest.TestCase):
    def test_complete_high_confidence_case_can_be_recommended(self):
        evaluation = Evaluation("CB-1", "MATH A", "MATH B", (match("calculus", .96), match("series", .94)), 2)
        result = evaluate_policy(evaluation)
        self.assertEqual(result.decision, "auto_recommend")
        self.assertFalse(result.requires_human)

    def test_material_weakness_requires_human(self):
        evaluation = Evaluation("CB-2", "CS A", "CS B", (match("oop", .96), match("assembly lab", .42)), 2)
        result = evaluate_policy(evaluation)
        self.assertEqual(result.decision, "human_review")
        self.assertTrue(result.requires_human)

    def test_missing_outcome_cannot_be_silently_accepted(self):
        evaluation = Evaluation("CB-3", "BIO A", "BIO B", (match("genetics", .92),), 2)
        self.assertEqual(evaluate_policy(evaluation).decision, "insufficient_evidence")

    def test_audit_receipts_are_chained_and_deterministic(self):
        first = append_receipt("GENESIS", "intake_agent", "extract", {"case": "CB-4"})
        second = append_receipt(first["event_hash"], "policy_agent", "pause", {"case": "CB-4"})
        self.assertEqual(second["previous_hash"], first["event_hash"])
        self.assertEqual(len(second["event_hash"]), 64)


if __name__ == "__main__":
    unittest.main()
