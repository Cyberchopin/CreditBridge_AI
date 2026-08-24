import { sealDecision } from "../../../../lib/demo-engine";
import { getCaseChainHead, persistDecision } from "../../../../lib/case-store";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    if (typeof body.caseId !== "string" || typeof body.decision !== "string" || typeof body.previousHash !== "string") {
      return Response.json({ error: "caseId, decision, and previousHash are required." }, { status: 400 });
    }
    if (body.decision !== "approve" && body.decision !== "escalate") {
      return Response.json({ error: "decision must be approve or escalate." }, { status: 422 });
    }
    const note = typeof body.note === "string" ? body.note : "";
    const authoritativeHead = await getCaseChainHead(body.caseId);
    const receipt = sealDecision(body.caseId, body.decision, note, authoritativeHead || body.previousHash);
    const auditEvent = {
      time: receipt.timestamp.slice(11, 19),
      actor: "Authorized Advisor",
      action: body.decision === "approve" ? "Approved equivalency with condition" : "Escalated to faculty reviewer",
      control: "Human decision",
      eventId: `evt_${receipt.receiptHash.slice(0, 8)}`,
    };
    const persisted = await persistDecision({
      caseId: body.caseId,
      decision: body.decision,
      note,
      previousHash: receipt.previousHash,
      receiptHash: receipt.receiptHash,
      timestamp: receipt.timestamp,
    });
    return Response.json({ ...receipt, auditEvent, persistence: persisted ? "durable" : "local-only" }, { status: 201, headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: "The authorized decision could not be recorded." }, { status: 500 });
  }
}
