import { sealDecision } from "../../../../lib/demo-engine";
import { persistDecision } from "../../../../lib/case-store";

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
    const receipt = sealDecision(body.caseId, body.decision, note, body.previousHash);
    const persisted = await persistDecision({
      caseId: body.caseId,
      decision: body.decision,
      note,
      previousHash: body.previousHash,
      receiptHash: receipt.receiptHash,
      timestamp: receipt.timestamp,
    });
    return Response.json({ ...receipt, persistence: persisted ? "durable" : "local-only" }, { status: 201, headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: "The authorized decision could not be recorded." }, { status: 500 });
  }
}
