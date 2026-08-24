import { invokeAgentCore } from "../../../../lib/agentcore";
import { analyzeDemoCase, DEFAULT_SYNTHETIC_SOURCE } from "../../../../lib/demo-engine";
import { persistAnalysis } from "../../../../lib/case-store";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    if (body.synthetic !== true) {
      return Response.json({ error: "Only synthetic or de-identified demonstration evidence is accepted." }, { status: 422 });
    }
    const sourceText = typeof body.sourceText === "string" ? body.sourceText.trim() : "";
    if (sourceText.length > 50_000) return Response.json({ error: "Demo source is limited to 50,000 characters." }, { status: 413 });
    const caseId = typeof body.caseId === "string" ? body.caseId : "CB-2026-0148";
    const analysis = analyzeDemoCase({
      caseId,
      sourceCourse: typeof body.sourceCourse === "string" ? body.sourceCourse : undefined,
      targetCourse: typeof body.targetCourse === "string" ? body.targetCourse : undefined,
      sourceText,
    });
    const execution = await invokeAgentCore({
      caseId: analysis.caseId,
      sourceBundle: sourceText || DEFAULT_SYNTHETIC_SOURCE,
      allowLive: body.preferAgentCore === true && sourceText.length === 0,
    });
    analysis.execution = execution;
    analysis.audit.push({
      time: new Date(execution.invokedAt).toISOString().slice(11, 19),
      actor: execution.mode.startsWith("agentcore") ? "AWS AgentCore" : "Policy Kernel",
      action: execution.mode === "agentcore_live"
        ? `Executed ${execution.runtime} with signed IAM request`
        : execution.mode === "agentcore_cached"
          ? `Verified cached ${execution.runtime} execution receipt`
          : "Completed deterministic safety fallback",
      control: execution.remoteStatus === "completed" ? "Verified" : "Controlled",
      eventId: `evt_${execution.traceId.replace(/[^a-zA-Z0-9]/g, "").slice(-8)}`,
    });
    const persisted = await persistAnalysis(analysis);
    return Response.json({ ...analysis, persistence: persisted ? "durable" : "local-only" }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: "The case could not be analyzed or persisted." }, { status: 500 });
  }
}
