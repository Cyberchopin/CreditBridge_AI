import { analyzeDemoCase } from "../../../../lib/demo-engine";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    if (body.synthetic !== true) {
      return Response.json({ error: "Only synthetic or de-identified demonstration evidence is accepted." }, { status: 422 });
    }
    const sourceText = typeof body.sourceText === "string" ? body.sourceText : "";
    if (sourceText.length > 50_000) return Response.json({ error: "Demo source is limited to 50,000 characters." }, { status: 413 });
    return Response.json(analyzeDemoCase({
      caseId: typeof body.caseId === "string" ? body.caseId : undefined,
      sourceCourse: typeof body.sourceCourse === "string" ? body.sourceCourse : undefined,
      targetCourse: typeof body.targetCourse === "string" ? body.targetCourse : undefined,
      sourceText,
    }), { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: "Invalid JSON request." }, { status: 400 });
  }
}
