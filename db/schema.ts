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
