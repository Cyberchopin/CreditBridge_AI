from __future__ import annotations

from hashlib import sha256
from strands import tool


@tool
def verify_document(filename: str, content: str) -> dict:
    """Create a content-integrity receipt for an academic source document."""
    return {"filename": filename, "sha256": sha256(content.encode()).hexdigest(), "verified": bool(content.strip())}


@tool
def extract_learning_outcomes(course_code: str, syllabus_text: str) -> dict:
    """Extract auditable candidate learning outcomes from supplied syllabus text."""
    statements = [line.strip(" -•\t") for line in syllabus_text.splitlines() if len(line.strip()) > 20]
    return {"course_code": course_code, "outcomes": statements[:20], "source": "submitted_syllabus"}


@tool
def request_human_review(case_id: str, reason: str, evidence_ids: list[str]) -> dict:
    """Pause the workflow and create a bounded academic decision request."""
    return {"case_id": case_id, "state": "awaiting_human", "reason": reason, "evidence_ids": evidence_ids, "authority": "academic_advisor"}
