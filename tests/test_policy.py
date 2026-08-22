import unittest

from agent_runtime.domain import Evaluation, OutcomeMatch, append_receipt, evaluate_policy
from agent_runtime.demo_service import analyze_deterministically, parse_request


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

    def test_invalid_score_is_rejected_before_policy_execution(self):
        with self.assertRaisesRegex(ValueError, "between 0 and 1"):
            Evaluation("CB-5", "CS A", "CS B", (match("oop", 1.2),), 1)

    def test_duplicate_citations_are_rejected(self):
        duplicated = OutcomeMatch("a", "a", .9, "same-citation")
        with self.assertRaisesRegex(ValueError, "unique source citation"):
            Evaluation("CB-6", "CS A", "CS B", (duplicated, duplicated), 2)

    def test_runtime_rejects_records_not_marked_synthetic(self):
        with self.assertRaisesRegex(ValueError, "synthetic"):
            parse_request({"case_id": "CB-7", "source_text": "real student record"})

    def test_deterministic_runtime_never_issues_final_credit_decision(self):
        request = parse_request({
            "synthetic": True,
            "case_id": "CB-8",
            "source_text": "Object-oriented design, data structures, memory models, and MIPS lab",
        })
        result = analyze_deterministically(request)
        self.assertIsNone(result["final_credit_decision"])
        self.assertEqual(result["execution_mode"], "deterministic")
        self.assertEqual(len(result["receipt"]["event_hash"]), 64)


if __name__ == "__main__":
    unittest.main()
