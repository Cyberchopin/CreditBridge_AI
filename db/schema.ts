import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const transferCases = sqliteTable("transfer_cases", {
  caseId: text("case_id").primaryKey(),
  sourceCourse: text("source_course").notNull(),
  targetCourse: text("target_course").notNull(),
  confidence: integer("confidence").notNull(),
  recommendation: text("recommendation").notNull(),
  status: text("status").notNull(),
  exception: text("exception"),
  documentHash: text("document_hash").notNull(),
  advisorNote: text("advisor_note"),
  receiptHash: text("receipt_hash"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("transfer_cases_status_idx").on(table.status),
  index("transfer_cases_updated_at_idx").on(table.updatedAt),
]);

export const auditEvents = sqliteTable("audit_events", {
  eventId: text("event_id").primaryKey(),
  caseId: text("case_id").notNull().references(() => transferCases.caseId, { onDelete: "cascade" }),
  occurredAt: text("occurred_at").notNull(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  control: text("control").notNull(),
  chainHash: text("chain_hash").notNull(),
}, (table) => [
  index("audit_events_case_id_idx").on(table.caseId),
]);

export const agentcoreRuns = sqliteTable("agentcore_runs", {
  runId: text("run_id").primaryKey(),
  cacheKey: text("cache_key").notNull(),
  caseId: text("case_id").notNull(),
  sourceHash: text("source_hash").notNull(),
  executionMode: text("execution_mode").notNull(),
  runtimeName: text("runtime_name").notNull(),
  region: text("region").notNull(),
  traceId: text("trace_id").notNull(),
  durationMs: integer("duration_ms").notNull(),
  responseHash: text("response_hash"),
  invokedAt: text("invoked_at").notNull(),
  expiresAt: text("expires_at").notNull(),
}, (table) => [
  index("agentcore_runs_cache_key_idx").on(table.cacheKey),
  index("agentcore_runs_invoked_at_idx").on(table.invokedAt),
  index("agentcore_runs_expires_at_idx").on(table.expiresAt),
]);
