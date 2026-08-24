import { createHash } from "node:crypto";

import type { DemoAnalysis } from "./demo-engine";

export type StoredCase = {
  caseId: string;
  sourceCourse: string;
  targetCourse: string;
  confidence: number;
  recommendation: DemoAnalysis["decision"];
  status: "human_review" | "packet_ready" | "approved" | "escalated";
  exception: string | null;
  documentHash: string;
  advisorNote: string | null;
  receiptHash: string | null;
  createdAt: string;
  updatedAt: string;
};

async function database() {
  try {
    const { env } = await import("cloudflare:workers");
    return env.DB ?? null;
  } catch {
    return null;
  }
}

function chainHash(previousHash: string, eventId: string, action: string) {
  return createHash("sha256").update(`${previousHash}:${eventId}:${action}`).digest("hex");
}

export async function persistAnalysis(analysis: DemoAnalysis): Promise<boolean> {
  const db = await database();
  if (!db) return false;

  const now = new Date().toISOString();
  const status = analysis.decision === "packet_ready" ? "packet_ready" : "human_review";
  const statements = [
    db.prepare(`
      INSERT INTO transfer_cases (
        case_id, source_course, target_course, confidence, recommendation,
        status, exception, document_hash, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(case_id) DO UPDATE SET
        source_course = excluded.source_course,
        target_course = excluded.target_course,
        confidence = excluded.confidence,
        recommendation = excluded.recommendation,
        status = excluded.status,
        exception = excluded.exception,
        document_hash = excluded.document_hash,
        updated_at = excluded.updated_at
    `).bind(
      analysis.caseId,
      analysis.sourceCourse,
      analysis.targetCourse,
      analysis.confidence,
      analysis.decision,
      status,
      analysis.exception,
      analysis.documentHash,
      now,
      now,
    ),
    ...analysis.audit.map((event) => db.prepare(`
      INSERT INTO audit_events (
        event_id, case_id, occurred_at, actor, action, control, chain_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(event_id) DO UPDATE SET
        occurred_at = excluded.occurred_at,
        actor = excluded.actor,
        action = excluded.action,
        control = excluded.control,
        chain_hash = excluded.chain_hash
    `).bind(
      event.eventId,
      analysis.caseId,
      now,
      event.actor,
      event.action,
      event.control,
      chainHash(analysis.documentHash, event.eventId, event.action),
    )),
  ];

  await db.batch(statements);
  return true;
}

export async function persistDecision(input: {
  caseId: string;
  decision: "approve" | "escalate";
  note: string;
  previousHash: string;
  receiptHash: string;
  timestamp: string;
}): Promise<boolean> {
  const db = await database();
  if (!db) return false;

  const status = input.decision === "approve" ? "approved" : "escalated";
  const eventId = `evt_${input.receiptHash.slice(0, 8)}`;
  const update = db.prepare(`
    UPDATE transfer_cases
    SET status = ?, advisor_note = ?, receipt_hash = ?, updated_at = ?
    WHERE case_id = ?
  `).bind(status, input.note, input.receiptHash, input.timestamp, input.caseId);
  const event = db.prepare(`
    INSERT INTO audit_events (
      event_id, case_id, occurred_at, actor, action, control, chain_hash
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(event_id) DO NOTHING
  `).bind(
    eventId,
    input.caseId,
    input.timestamp,
    "Authorized Advisor",
    input.decision === "approve" ? "Approved equivalency with condition" : "Escalated to faculty reviewer",
    "Human decision",
    chainHash(input.previousHash, eventId, input.decision),
  );

  const [result] = await db.batch([update, event]);
  if ((result.meta.changes ?? 0) < 1) {
    throw new Error("Decision cannot be recorded before the case analysis exists.");
  }
  return true;
}

export async function listCases(limit = 20): Promise<StoredCase[] | null> {
  const db = await database();
  if (!db) return null;

  const result = await db.prepare(`
    SELECT
      case_id AS caseId,
      source_course AS sourceCourse,
      target_course AS targetCourse,
      confidence,
      recommendation,
      status,
      exception,
      document_hash AS documentHash,
      advisor_note AS advisorNote,
      receipt_hash AS receiptHash,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM transfer_cases
    ORDER BY updated_at DESC
    LIMIT ?
  `).bind(Math.max(1, Math.min(limit, 50))).all<StoredCase>();

  return result.results;
}
