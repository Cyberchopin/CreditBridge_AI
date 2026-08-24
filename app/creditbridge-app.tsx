"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

type View = "queue" | "case" | "audit";
type PipelineState = "ready" | "running" | "review" | "approved";
type Analysis = {
  caseId: string;
  sourceCourse: string;
  targetCourse: string;
  confidence: number;
  decision: "human_review" | "packet_ready" | "insufficient_evidence";
  exception: string | null;
  outcomes: Array<{ label: string; classification: "Direct" | "Partial" | "Missing depth"; score: number; citation: string }>;
  documentHash: string;
  audit: Array<{ time: string; actor: string; action: string; control: string; eventId: string }>;
  persistence?: "durable" | "local-only";
};
type StoredCase = {
  caseId: string;
  sourceCourse: string;
  targetCourse: string;
  confidence: number;
  status: "human_review" | "packet_ready" | "approved" | "escalated";
  updatedAt: string;
};

const agentSteps = [
  { name: "Intake", detail: "Normalized 3 source documents", tone: "green" },
  { name: "Evidence", detail: "Found 14 cited learning outcomes", tone: "green" },
  { name: "Matching", detail: "Computed outcome-level alignment", tone: "green" },
  { name: "Policy", detail: "Flagged one material ambiguity", tone: "amber" },
  { name: "Packet", detail: "Waiting for advisor determination", tone: "muted" },
];

const auditRows = [
  ["10:42:18", "Intake Agent", "Extracted IVC CS 38", "Verified", "evt_84f1"],
  ["10:42:21", "Evidence Agent", "Indexed syllabus sections 2–8", "Verified", "evt_1c22"],
  ["10:42:25", "Matching Agent", "Compared 14 learning outcomes", "Verified", "evt_71ba"],
  ["10:42:29", "Policy Agent", "Raised lab-depth exception", "Review", "evt_af09"],
  ["10:42:31", "System", "Paused before irreversible decision", "Controlled", "evt_03dd"],
];

const icons: Record<string, React.ReactNode> = {
  overview: <path d="M4 5h16M4 12h10M4 19h16" />,
  cases: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 5V3h8v2M8 10h8M8 14h5" /></>,
  evidence: <><path d="M6 3h9l3 3v15H6z" /><path d="M14 3v4h4M9 12h6M9 16h4" /></>,
  policy: <><path d="M12 3 4.5 6v5.5c0 4.8 3 7.7 7.5 9.5 4.5-1.8 7.5-4.7 7.5-9.5V6z" /><path d="m9 12 2 2 4-5" /></>,
  audit: <><path d="M5 4h14v16H5z" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
};

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name]}</svg>;
}

function Logo() { return <div className="logo-mark" aria-hidden="true"><span>C</span><i /></div>; }

function Metric({ label, value, detail, accent }: { label: string; value: string; detail: string; accent?: boolean }) {
  return <article className={`metric-card ${accent ? "metric-accent" : ""}`}><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="metric-detail">{detail}</div></article>;
}

export default function CreditBridgeApp() {
  const [view, setView] = useState<View>("case");
  const [pipeline, setPipeline] = useState<PipelineState>("review");
  const [activeStep, setActiveStep] = useState(5);
  const [selectedMatch, setSelectedMatch] = useState("CS 33");
  const [note, setNote] = useState("");
  const [toast, setToast] = useState("");
  const [uploaded, setUploaded] = useState<string[]>([]);
  const [sourceText, setSourceText] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [receiptHash, setReceiptHash] = useState("");
  const [savedCases, setSavedCases] = useState<StoredCase[]>([]);
  const [ledgerMode, setLedgerMode] = useState<"durable" | "local-only">("local-only");
  const fileRef = useRef<HTMLInputElement>(null);
  const statusLabel = useMemo(() => ({ ready: "Ready to analyze", running: "Agents working", review: "Human review required", approved: "Decision recorded" }[pipeline]), [pipeline]);

  async function refreshCases() {
    try {
      const response = await fetch("/api/demo/cases", { cache: "no-store" });
      if (!response.ok) return;
      const result = await response.json() as { cases: StoredCase[]; persistence: "durable" | "local-only" };
      setSavedCases(result.cases);
      setLedgerMode(result.persistence);
    } catch {
      setLedgerMode("local-only");
    }
  }

  useEffect(() => {
    let active = true;
    void fetch("/api/demo/cases", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((result: { cases: StoredCase[]; persistence: "durable" | "local-only" } | null) => {
        if (!active || !result) return;
        setSavedCases(result.cases);
        setLedgerMode(result.persistence);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  function notify(message: string) { setToast(message); window.setTimeout(() => setToast(""), 2600); }
  async function runPipeline() {
    if (pipeline === "running") return;
    setPipeline("running"); setActiveStep(0);
    let step = 0;
    const timer = window.setInterval(() => { step = Math.min(step + 1, 4); setActiveStep(step); }, 430);
    try {
      const response = await fetch("/api/demo/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ synthetic: true, caseId: "CB-2026-0148", sourceCourse: "IVC CS 38", targetCourse: `UCLA ${selectedMatch}`, sourceText }) });
      if (!response.ok) throw new Error("analysis request failed");
      const result = await response.json() as Analysis;
      setAnalysis(result); setActiveStep(5); setPipeline(result.decision === "packet_ready" ? "ready" : "review");
      setLedgerMode(result.persistence || "local-only");
      await refreshCases();
      notify(result.decision === "packet_ready" ? "Evidence packet ready for authorized review" : "Analysis complete — one decision requires your review");
    } catch {
      setPipeline("ready"); setActiveStep(0); notify("Analysis could not complete. No decision was recorded.");
    } finally { window.clearInterval(timer); }
  }
  async function decide(decision: "approve" | "escalate") {
    const response = await fetch("/api/demo/decision", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ caseId: analysis?.caseId || "CB-2026-0148", decision, note, previousHash: analysis?.documentHash || "demo-genesis" }) });
    if (!response.ok) { notify("Decision was not recorded."); return; }
    const receipt = await response.json() as { receiptHash: string; persistence?: "durable" | "local-only" };
    setReceiptHash(receipt.receiptHash);
    setLedgerMode(receipt.persistence || "local-only");
    await refreshCases();
    if (decision === "approve") { setPipeline("approved"); notify("Equivalency approved and audit receipt sealed"); }
    else { setPipeline("review"); notify("Case routed to Computer Science faculty reviewer"); }
  }
  async function onFiles(event: ChangeEvent<HTMLInputElement>) {
    const names = Array.from(event.target.files ?? []).map((file) => file.name); setUploaded(names);
    const readable = Array.from(event.target.files ?? []).find((file) => /\.(txt|csv|json|md)$/i.test(file.name));
    if (readable) setSourceText((await readable.text()).slice(0, 50_000));
    if (names.length) notify(`${names.length} synthetic text source${names.length > 1 ? "s" : ""} added to this case`);
  }
  function exportReport() {
    const payload = { generatedAt: new Date().toISOString(), syntheticDemo: true, analysis, decision: pipeline, advisorNote: note, receiptHash };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = `${analysis?.caseId || "creditbridge-demo"}-evidence-packet.json`; link.click(); URL.revokeObjectURL(url);
    notify("Evidence packet exported");
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><Logo /><div><strong>CreditBridge</strong><span>Academic Operations</span></div></div>
      <nav aria-label="Primary navigation">
        <button className={view === "queue" ? "nav-active" : ""} onClick={() => setView("queue")}><Icon name="overview" />Overview</button>
        <button className={view === "case" ? "nav-active" : ""} onClick={() => setView("case")}><Icon name="cases" />Cases<span className="nav-count">8</span></button>
        <button onClick={() => notify("Evidence library indexed: 1,248 course records")}><Icon name="evidence" />Evidence library</button>
        <button onClick={() => notify("Policy set v2.4 is active")}><Icon name="policy" />Policy controls</button>
        <button className={view === "audit" ? "nav-active" : ""} onClick={() => setView("audit")}><Icon name="audit" />Audit trail</button>
      </nav>
      <div className="sidebar-bottom"><div className="system-state"><span className="pulse-dot" /><div><strong>All systems operational</strong><small>5 agents · policy v2.4</small></div></div><div className="advisor"><div className="avatar">SW</div><div><strong>Shiyue Wang</strong><small>Transfer evaluator</small></div><span>•••</span></div></div>
    </aside>

    <main className="workspace">
      <header className="topbar"><div><p className="eyebrow">TRANSFER CREDIT OPERATIONS</p><h1>{view === "case" ? "Decision workspace" : view === "audit" ? "Evidence audit trail" : "Advisor command center"}</h1></div><div className="top-actions"><button className="icon-button" aria-label="Notifications">●<span /></button><button className="secondary" onClick={exportReport}>↓ Export</button><button className="secondary" onClick={() => fileRef.current?.click()}>＋ Add source text</button><input ref={fileRef} type="file" multiple hidden onChange={onFiles} accept=".txt,.csv,.json,.md" /><button className="primary" onClick={runPipeline}>{pipeline === "running" ? "Analyzing…" : "Run agents"}<span>→</span></button></div></header>

      {view === "queue" && <Overview onOpen={() => setView("case")} savedCases={savedCases} ledgerMode={ledgerMode} />}
      {view === "audit" && <Audit analysis={analysis} receiptHash={receiptHash} />}
      {view === "case" && <>
        <section className="case-strip"><div><button className="back" onClick={() => setView("queue")}>← All cases</button><div className="case-title"><span className="case-id">CB-2026-0148</span><h2>IVC CS 38 → UCLA Computer Science</h2><span className={`status-pill status-${pipeline}`}>{statusLabel}</span></div></div><div className="case-meta"><span>Record <strong>Synthetic D-1048</strong></span><span>Ledger <strong className={ledgerMode === "durable" ? "good" : ""}>{ledgerMode === "durable" ? "Durable" : "Local demo"}</strong></span><span>SLA <strong className="good">18h remaining</strong></span></div></section>
        {uploaded.length > 0 && <div className="upload-banner"><strong>Synthetic evidence ready</strong><span>{uploaded.join(" · ")} · do not upload real student records</span><button onClick={runPipeline}>Analyze now</button></div>}
        <section className="metrics"><Metric label="Recommended match" value={selectedMatch} detail="UCLA Computer Science" /><Metric label="Evidence confidence" value={`${analysis?.confidence ?? 87}%`} detail={`${analysis?.outcomes.length ?? 4} required outcomes evaluated`} accent /><Metric label="Estimated time saved" value="2.4h" detail="Per evaluation case" /><Metric label="Decision risk" value={analysis?.decision === "packet_ready" ? "Low" : "Medium"} detail={analysis?.exception || "Lab-depth ambiguity"} /></section>

        <section className="content-grid"><div className="left-stack">
          <article className="panel pipeline-panel"><div className="panel-head"><div><p className="section-kicker">AGENT ORCHESTRATION</p><h3>Case execution</h3></div><span className={`live-chip ${pipeline === "running" ? "is-running" : ""}`}><i />{pipeline === "running" ? "Processing" : "Paused safely"}</span></div><div className="agent-flow">{agentSteps.map((step, index) => <div className={`agent-row ${index < activeStep ? "done" : index === activeStep && pipeline === "running" ? "working" : "waiting"}`} key={step.name}><div className="agent-index">{index < activeStep ? "✓" : String(index + 1).padStart(2, "0")}</div><div className="agent-copy"><strong>{step.name} Agent</strong><span>{index < activeStep ? step.detail : index === activeStep && pipeline === "running" ? "Executing tools and recording evidence…" : "Waiting for upstream result"}</span></div><div className={`agent-result ${step.tone}`}>{index < activeStep ? (index === 3 ? "1 exception" : "Complete") : "Pending"}</div></div>)}</div></article>

          <article className="panel evidence-panel"><div className="panel-head"><div><p className="section-kicker">EVIDENCE GRAPH</p><h3>Outcome-level comparison</h3></div><button className="text-button" onClick={() => notify(`${analysis?.outcomes.length ?? 4} evidence citations verified against source text`)}>View citations ↗</button></div><div className="course-headings"><div><span>SOURCE COURSE</span><strong>{analysis?.sourceCourse || "IVC CS 38"}</strong><small>Submitted course evidence</small></div><div className="match-score"><span>{analysis?.confidence ?? 87}%</span><small>evidence + policy score</small></div><div><span>CANDIDATE MATCH</span><strong>{analysis?.targetCourse || `UCLA ${selectedMatch}`}</strong><small>Computer Organization</small></div></div><div className="outcomes">{(analysis?.outcomes || [{label:"Object-oriented design",classification:"Direct",score:.96},{label:"Data structures & algorithms",classification:"Direct",score:.93},{label:"Memory & machine representation",classification:"Partial",score:.71},{label:"Assembly programming laboratory",classification:"Missing depth",score:.42}]).map((item,i) => <div className="outcome" key={item.label}><span className="outcome-num">0{i+1}</span><strong>{item.label}</strong><span className={item.classification.includes("Missing") ? "warn" : item.classification === "Partial" ? "partial" : "match"}>{item.classification}</span><b>{Math.round(item.score*100)}%</b></div>)}</div><div className="source-proof"><span className="proof-icon">“</span><div><strong>Source-grounded finding</strong><p>{analysis?.exception || "IVC CS 38 covers Java memory models and references, but the submitted syllabus does not demonstrate assembly-language lab work comparable to CS 33 weeks 2–5."}</p><small>{analysis ? `Submitted source · SHA-256 ${analysis.documentHash.slice(0, 16)}… verified` : "IVC_CS38_Syllabus.pdf · pages 4–6 · SHA-256 verified"}</small></div></div></article>
        </div>

        <aside className="right-stack"><article className="panel decision-panel"><p className="section-kicker">HUMAN DECISION REQUIRED</p><div className="decision-icon">!</div><h3>Resolve lab-depth ambiguity</h3><p>The agent found strong conceptual alignment but cannot authorize equivalency because assembly lab evidence is incomplete.</p><label>Proposed equivalency<select value={selectedMatch} onChange={(e) => setSelectedMatch(e.target.value)}><option>CS 33</option><option>PIC 10C</option><option>Elective credit</option></select></label><label>Advisor note<textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional rationale for the permanent record…" /></label>{pipeline === "approved" ? <div className="approved-box"><strong>✓ Decision recorded</strong><span>Receipt sealed with policy v2.4</span></div> : <><button className="approve" onClick={() => decide("approve")}>Approve with condition</button><button className="escalate" onClick={() => decide("escalate")}>Escalate to faculty reviewer</button></>}<div className="safety-note"><Icon name="policy" size={16} />CreditBridge never finalizes academic credit without an authorized human decision.</div></article>
          <article className="panel docs-panel"><div className="panel-head"><h3>Case documents</h3><span>{uploaded.length ? `${uploaded.length} supplied` : "3 verified"}</span></div>{(uploaded.length ? uploaded.map((file) => [file,"Ready for analysis"]) : [["Transcript.pdf","Registrar verified"], ["CS38_Syllabus.pdf","8 pages indexed"], ["UCLA_Degree_Audit.pdf","Policy context"]]).map(([file,meta]) => <button key={file} onClick={() => notify(`${file}: source integrity verified`)}><span className="doc-icon">SRC</span><div><strong>{file}</strong><small>{meta}</small></div><span>⋮</span></button>)}</article>
        </aside></section>

        <article className="audit-preview panel"><div className="panel-head"><div><p className="section-kicker">ACCOUNTABLE BY DESIGN</p><h3>Immutable activity trail</h3></div><button className="text-button" onClick={() => setView("audit")}>Open full audit trail →</button></div><div className="audit-line">{(analysis?.audit.map((item) => [item.time,item.actor,item.action,item.control,item.eventId]) || auditRows).slice(0,4).map((row) => <div key={row[4]}><span>{row[0]}</span><strong>{row[1]}</strong><p>{row[2]}</p><em className={row[3] === "Review" ? "review" : "verified"}>{row[3]}</em></div>)}</div></article>
      </>}
    </main>
    {toast && <div className="toast" role="status"><span>✓</span>{toast}</div>}
  </div>;
}

function Overview({ onOpen, savedCases, ledgerMode }: { onOpen: () => void; savedCases: StoredCase[]; ledgerMode: "durable" | "local-only" }) {
  const rows = savedCases.length ? savedCases : [
    { caseId: "CB-2026-0148", sourceCourse: "IVC CS 38", targetCourse: "UCLA CS 33", confidence: 87, status: "human_review" as const, updatedAt: "" },
    { caseId: "CB-2026-0147", sourceCourse: "SCC MATH 3A", targetCourse: "UCLA MATH 31A", confidence: 96, status: "packet_ready" as const, updatedAt: "" },
    { caseId: "CB-2026-0145", sourceCourse: "DVC COMSC 210", targetCourse: "UCLA PIC 10B", confidence: 79, status: "human_review" as const, updatedAt: "" },
  ];
  const stateLabel = { human_review: "Human review", packet_ready: "Packet ready", approved: "Approved", escalated: "Faculty review" };
  return <div className="overview-page"><section className="overview-hero"><div><span className="signal">LIVE OPERATIONS · {ledgerMode === "durable" ? "DURABLE LEDGER ACTIVE" : "SYNTHETIC DEMO"}</span><h2>Eight cases. Two decisions.<br />No paperwork lost.</h2><p>CreditBridge processes evidence inside bounded policy controls and persists every authorized decision with a tamper-evident receipt.</p></div><div className="throughput"><strong>{savedCases.length || 8}</strong><span>cases in the decision ledger</span><small>{ledgerMode === "durable" ? "D1 persistence verified" : "ready for hosted storage"}</small></div></section><section className="metrics"><Metric label="Open cases" value={String(rows.filter((item) => item.status === "human_review").length)} detail="Requiring academic judgment" /><Metric label="Autonomous completion" value="74%" detail="Within approved policy bounds" accent /><Metric label="Median review time" value="11m" detail="Down from 2.6 hours" /><Metric label="Recorded cases" value={String(savedCases.length)} detail={ledgerMode === "durable" ? "Stored across sessions" : "Awaiting hosted ledger"} /></section><article className="panel queue-panel"><div className="panel-head"><div><p className="section-kicker">PRIORITY QUEUE</p><h3>Cases requiring attention</h3></div><span className={`ledger-chip ${ledgerMode === "durable" ? "ledger-live" : ""}`}>{ledgerMode === "durable" ? "● Durable" : "○ Demo"}</span></div><div className="queue-head"><span>Case</span><span>Course path</span><span>Confidence</span><span>State</span><span>Updated</span></div>{rows.slice(0, 6).map((item) => <button className="queue-row" onClick={onOpen} key={item.caseId}><div><strong>{item.caseId}</strong><small>{item.sourceCourse}</small></div><span>{item.targetCourse}</span><b>{item.confidence}%</b><em className={item.status === "packet_ready" || item.status === "approved" ? "verified" : "review"}>{stateLabel[item.status]}</em><span>{item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : "Demo"}</span></button>)}</article></div>;
}

function Audit({ analysis, receiptHash }: { analysis: Analysis | null; receiptHash: string }) {
  const rows = analysis?.audit.map((item) => [item.time, item.actor, item.action, item.control, item.eventId]) || auditRows;
  const root = receiptHash || analysis?.documentHash || "4b87c91a";
  return <div className="audit-page"><section className="audit-summary"><div><span>CASE</span><strong>{analysis?.caseId || "CB-2026-0148"}</strong><small>Every claim traceable to source</small></div><div><span>EVENTS</span><strong>{rows.length}</strong><small>0 mutations detected</small></div><div><span>POLICY</span><strong>v2.4</strong><small>Effective Aug 01, 2026</small></div><div><span>INTEGRITY</span><strong className="good">Verified</strong><small>{receiptHash ? "Human receipt sealed" : "Evidence hash present"}</small></div></section><article className="panel audit-table"><div className="panel-head"><div><p className="section-kicker">PROVENANCE LEDGER</p><h3>Case events</h3></div><button className="secondary" onClick={() => window.print()}>Export receipt</button></div><div className="audit-table-head"><span>Time</span><span>Actor</span><span>Action</span><span>Control</span><span>Event ID</span></div>{rows.map(row => <div className="audit-table-row" key={row[4]}><span>{row[0]}</span><strong>{row[1]}</strong><span>{row[2]}</span><em className={row[3] === "Review" ? "review" : "verified"}>{row[3]}</em><code>{row[4]}</code></div>)}</article><article className="integrity panel"><div className="integrity-mark">✓</div><div><h3>Evidence chain verified</h3><p>All agent inputs, policy evaluations, and human decisions are linked by tamper-evident receipts. No mutation was detected in this synthetic demo packet.</p></div><code>root: {root.slice(0, 8)}…{root.slice(-4)}</code></article></div>;
}
