import { listCases } from "../../../../lib/case-store";

export async function GET() {
  try {
    const cases = await listCases();
    return Response.json({
      cases: cases ?? [],
      persistence: cases ? "durable" : "local-only",
    }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: "The case ledger is temporarily unavailable." }, { status: 503 });
  }
}
