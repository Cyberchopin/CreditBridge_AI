# CreditBridge AI

**Autonomous transfer-credit operations with human-controlled academic decisions.**

CreditBridge receives transcripts, syllabi, and degree requirements; constructs a cited evidence graph; compares course outcomes; applies institutional policy; and assembles a decision-ready packet. It interrupts an advisor only when evidence is incomplete, contradictory, low-confidence, or requires academic judgment.

> CreditBridge recommends and prepares. Authorized institutional staff make every final credit decision.

## Why it matters

Transfer-credit evaluation is a high-volume, document-heavy workflow. Evidence arrives in inconsistent formats, equivalency decisions require source-level justification, and missing information creates repeated exchanges between students, advisors, departments, and registrars. CreditBridge converts that fragmented process into a bounded, observable workflow without pretending that an AI model has academic authority.

## Product workflow

1. **Intake Agent** validates files and normalizes course, unit, grade, and institution data.
2. **Evidence Agent** extracts learning outcomes with page-level source citations.
3. **Matching Agent** compares outcomes, rigor, assessment depth, contact hours, prerequisites, and laboratory work.
4. **Policy Agent** applies explicit institutional thresholds and stops on material ambiguity.
5. **Packet Agent** assembles the recommendation, missing-evidence request, and permanent review packet.
6. **Human decision gate** requires an authorized advisor or faculty reviewer for the final determination.

```mermaid
flowchart LR
    A[Academic documents] --> B[Intake + integrity]
    B --> C[Evidence graph]
    C --> D[Outcome matching]
    D --> E{Policy gate}
    E -->|Within bounds| F[Recommendation packet]
    E -->|Ambiguous| G[Human review]
    G --> F
    F --> H[Audit receipt]
```

## What is working in v0.1

- Advisor operations dashboard with queue, case workspace, evidence comparison, decision gate, and provenance ledger.
- Upload interaction for transcript, syllabus, degree-audit, and supporting documents.
- Five-stage runnable workflow visualization with explicit pause-before-decision behavior.
- Outcome-level matching with cited source findings and confidence indicators.
- Advisor approval, conditional approval, and faculty escalation interactions.
- Tamper-evident audit receipt primitives.
- Deterministic policy kernel with tests for high-confidence, weak, and incomplete evidence.
- Strands Agents SDK implementation with specialized agents and bounded tools.
- Responsive desktop and mobile layout.

The hosted interface uses a synthetic, de-identified demonstration case. It does not claim a live university integration or a production academic determination.

## Architecture

| Layer | Responsibility | Initial implementation |
|---|---|---|
| Experience | Advisor queue, evidence inspection, decisions | Next.js, React, TypeScript |
| Orchestration | Fixed, observable agent sequence | Strands Agents SDK |
| Decision kernel | Deterministic thresholds and escalation | Pure Python domain module |
| Evidence | Source citations and document integrity | SHA-256 receipts, structured outcomes |
| Governance | Human authority and policy boundaries | Mandatory decision gate |
| Observability | Event provenance and mutation detection | Hash-chained audit receipts |

The architecture deliberately separates probabilistic extraction and matching from deterministic authorization. Model output can propose evidence and candidates; policy code determines whether the case must stop, and a human owns the consequential decision.

## Local setup

### Interface

```bash
npm ci
npm run dev
```

### Agent runtime

Python 3.10+ and AWS credentials with access to a supported Amazon Bedrock model are required for live Strands inference.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pytest -q tests/test_policy.py
```

The policy tests do not call a model or require AWS credentials.

## Security and privacy boundaries

- No silent award, denial, or modification of academic credit.
- No inference of missing grades, units, institutions, or course identities.
- Every material claim must carry a source citation.
- Low-confidence, conflicting, or incomplete evidence routes to a human.
- Demonstration records are synthetic and contain no student education records.
- Production deployment requires institution-controlled identity, retention, encryption, and FERPA review.

## Evaluation plan

- Field extraction accuracy.
- Outcome-to-source citation precision.
- Equivalency candidate recall at `k`.
- False auto-clear rate, which must remain zero for policy-gated cases.
- Correct escalation rate.
- Median advisor handling time.
- Reproducibility of generated packets and audit receipts.

## Repository policy

CreditBridge AI was created during the 2026 Agents for Humans submission period. It uses open-source frameworks and standard development tooling. It is a new codebase and does not copy code from Continuum, Continuum Sentinel, or earlier projects.

Released under the [MIT License](LICENSE).
