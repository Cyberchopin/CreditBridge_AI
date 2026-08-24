import assert from "node:assert/strict";
import test from "node:test";

test("renders CreditBridge product metadata and primary workflow", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  const html = await response.text();
  assert.match(html, /<title>CreditBridge AI<\/title>/i);
  assert.match(html, /Decision workspace/i);
  assert.match(html, /Human review required/i);
  assert.doesNotMatch(html, /codex-preview/i);
});

test("executes the synthetic evidence API and seals a human receipt", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `api-${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const env = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  const analysisResponse = await worker.fetch(new Request("http://localhost/api/demo/run", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      synthetic: true,
      caseId: "CB-TEST-1",
      sourceCourse: "DEMO CS 38",
      targetCourse: "DEMO CS 33",
      sourceText: "Object-oriented design, data structures and algorithms, memory models",
      preferAgentCore: true,
    }),
  }), env, ctx);
  assert.equal(analysisResponse.status, 200);
  const analysis = await analysisResponse.json();
  assert.equal(analysis.caseId, "CB-TEST-1");
  assert.equal(analysis.decision, "human_review");
  assert.equal(analysis.documentHash.length, 64);
  assert.equal(analysis.execution.mode, "deterministic");
  assert.equal(analysis.execution.remoteStatus, "unavailable");
  assert.match(analysis.execution.fallbackReason, /fixed synthetic fixture/i);
  assert.equal(analysis.audit.at(-1).actor, "Policy Kernel");

  const receiptResponse = await worker.fetch(new Request("http://localhost/api/demo/decision", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ caseId: analysis.caseId, decision: "escalate", previousHash: analysis.documentHash, note: "Faculty review required." }),
  }), env, ctx);
  assert.equal(receiptResponse.status, 201);
  const receipt = await receiptResponse.json();
  assert.equal(receipt.receiptHash.length, 64);
  assert.equal(receipt.authorityRequired, true);
  assert.equal(receipt.auditEvent.actor, "Authorized Advisor");
  assert.equal(receipt.auditEvent.control, "Human decision");
});

test("rejects evidence not explicitly marked synthetic", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `guard-${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(new Request("http://localhost/api/demo/run", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sourceText: "student record" }),
  }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
  assert.equal(response.status, 422);
});
