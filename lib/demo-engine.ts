import { createHash } from "node:crypto";

export type DemoCaseInput = {
  caseId?: string;
  sourceCourse?: string;
  targetCourse?: string;
  sourceText?: string;
};

export type DemoOutcome = {
  label: string;
  classification: "Direct" | "Partial" | "Missing depth";
  score: number;
  citation: string;
};

export type AuditEvent = {
  time: string;
  actor: string;
  action: string;
  control: string;
  eventId: string;
};

export type ExecutionReceipt = {
  mode: "agentcore_live" | "agentcore_cached" | "deterministic";
  runtime: string;
  region: string;
  traceId: string;
  durationMs: number;
  invokedAt: string;
  responseHash: string | null;
  remoteStatus: "completed" | "unavailable";
  fallbackReason?: string;
};

export type DemoAnalysis = {
  caseId: string;
  sourceCourse: string;
  targetCourse: string;
  confidence: number;
  decision: "human_review" | "packet_ready" | "insufficient_evidence";
  exception: string | null;
  outcomes: DemoOutcome[];
  documentHash: string;
  audit: AuditEvent[];
  execution?: ExecutionReceipt;
};

export const DEFAULT_SYNTHETIC_SOURCE = "Object-oriented design\nData structures and algorithms\nMemory models and machine representation\nJava programming laboratory";

function contains(text: string, terms: string[]) {
  const normalized = text.toLowerCase();
  return terms.some((term) => normalized.includes(term));
}

function eventId(caseId: string, index: number, action: string) {
  return `evt_${createHash("sha256").update(`${caseId}:${index}:${action}`).digest("hex").slice(0, 8)}`;
}

export function analyzeDemoCase(input: DemoCaseInput): DemoAnalysis {
  const caseId = (input.caseId || "CB-2026-0148").slice(0, 64);
  const sourceCourse = (input.sourceCourse || "IVC CS 38").slice(0, 80);
  const targetCourse = (input.targetCourse || "UCLA CS 33").slice(0, 80);
  const text = (input.sourceText || DEFAULT_SYNTHETIC_SOURCE).slice(0, 50_000);
  const documentHash = createHash("sha256").update(text).digest("hex");
  const outcomes: DemoOutcome[] = [
    { label: "Object-oriented design", classification: contains(text, ["object-oriented", "object oriented", "oop"]) ? "Direct" : "Partial", score: contains(text, ["object-oriented", "object oriented", "oop"]) ? 0.96 : 0.58, citation: "submitted_source#object-oriented-design" },
    { label: "Data structures & algorithms", classification: contains(text, ["data structure", "algorithm"]) ? "Direct" : "Partial", score: contains(text, ["data structure", "algorithm"]) ? 0.93 : 0.55, citation: "submitted_source#data-structures" },
    { label: "Memory & machine representation", classification: contains(text, ["memory", "machine representation", "computer organization"]) ? "Direct" : "Partial", score: contains(text, ["memory", "machine representation", "computer organization"]) ? 0.82 : 0.49, citation: "submitted_source#memory" },
    { label: "Assembly programming laboratory", classification: contains(text, ["assembly lab", "assembly-language laboratory", "mips lab"]) ? "Direct" : "Missing depth", score: contains(text, ["assembly lab", "assembly-language laboratory", "mips lab"]) ? 0.91 : 0.42, citation: "submitted_source#laboratory" },
  ];
  const confidence = Math.round(outcomes.reduce((sum, item) => sum + item.score, 0) / outcomes.length * 100);
  const weak = outcomes.filter((item) => item.score < 0.7);
  const decision = !text.trim() ? "insufficient_evidence" : weak.length ? "human_review" : "packet_ready";
  const exception = decision === "human_review" ? `${weak.map((item) => item.label).join(", ")} requires academic judgment.` : decision === "insufficient_evidence" ? "No usable source evidence was supplied." : null;
  const actions = [
    ["Intake Agent", `Verified ${sourceCourse} source`, "Verified"],
    ["Evidence Agent", `Indexed ${outcomes.length} required outcomes`, "Verified"],
    ["Matching Agent", `Computed ${sourceCourse} → ${targetCourse}`, "Verified"],
    ["Policy Agent", decision === "packet_ready" ? "Policy thresholds satisfied" : "Raised bounded exception", decision === "packet_ready" ? "Verified" : "Review"],
    ["System", decision === "packet_ready" ? "Prepared recommendation packet" : "Paused before consequential decision", "Controlled"],
  ];
  return {
    caseId, sourceCourse, targetCourse, confidence, decision, exception, outcomes, documentHash,
    audit: actions.map(([actor, action, control], index) => ({ time: `10:42:${String(18 + index * 3).padStart(2, "0")}`, actor, action, control, eventId: eventId(caseId, index, action) })),
  };
}

export function sealDecision(caseId: string, decision: string, note: string, previousHash: string) {
  const timestamp = new Date().toISOString();
  const payload = { caseId: caseId.slice(0, 64), decision: decision.slice(0, 40), note: note.slice(0, 2_000), timestamp, previousHash };
  const receiptHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  return { ...payload, receiptHash, authorityRequired: true };
}
