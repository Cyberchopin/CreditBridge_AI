import { sealDecision } from "../../../../lib/demo-engine";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    if (typeof body.caseId !== "string" || typeof body.decision !== "string" || typeof body.previousHash !== "string") {
      return Response.json({ error: "caseId, decision, and previousHash are required." }, { status: 400 });
    }
    return Response.json(sealDecision(body.caseId, body.decision, typeof body.note === "string" ? body.note : "", body.previousHash), { status: 201, headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: "Invalid JSON request." }, { status: 400 });
  }
}
