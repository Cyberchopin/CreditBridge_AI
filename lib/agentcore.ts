import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";

import type { ExecutionReceipt } from "./demo-engine";

const REGION = "us-east-1";
const RUNTIME_NAME = "CreditBridgeCloudAgent";
const CACHE_TTL_MS = 15 * 60 * 1_000;
const DAILY_LIVE_LIMIT = 12;
const MAX_SOURCE_LENGTH = 12_000;

type AgentCoreConfig = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  runtimeArn: string;
  enabled: boolean;
};

type CachedReceipt = {
  executionMode: "agentcore_live";
  runtimeName: string;
  region: string;
  traceId: string;
  durationMs: number;
  responseHash: string;
  invokedAt: string;
  expiresAt: string;
};

async function bindings() {
  try {
    const { env } = await import("cloudflare:workers");
    return env;
  } catch {
    return null;
  }
}

function stringBinding(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function config(): Promise<AgentCoreConfig | null> {
  const env = await bindings();
  if (!env) return null;
  const values = env as unknown as Record<string, unknown>;
  const accessKeyId = stringBinding(values.AGENTCORE_AWS_ACCESS_KEY_ID);
  const secretAccessKey = stringBinding(values.AGENTCORE_AWS_SECRET_ACCESS_KEY);
  const runtimeArn = stringBinding(values.AGENTCORE_RUNTIME_ARN);
  const enabled = ["1", "true", "yes"].includes(stringBinding(values.AGENTCORE_LIVE_ENABLED).toLowerCase());
  if (!enabled || !accessKeyId || !secretAccessKey || !runtimeArn) return null;
  return {
    accessKeyId,
    secretAccessKey,
    runtimeArn,
    enabled,
    sessionToken: stringBinding(values.AGENTCORE_AWS_SESSION_TOKEN) || undefined,
  };
}

async function database() {
  const env = await bindings();
  return env?.DB ?? null;
}

function fallback(reason: string): ExecutionReceipt {
  return {
    mode: "deterministic",
    runtime: "Cloudflare policy kernel",
    region: "WNAM",
    traceId: `local_${randomUUID()}`,
    durationMs: 0,
    invokedAt: new Date().toISOString(),
    responseHash: null,
    remoteStatus: "unavailable",
    fallbackReason: reason,
  };
}

function fromCache(row: CachedReceipt): ExecutionReceipt {
  return {
    mode: "agentcore_cached",
    runtime: row.runtimeName,
    region: row.region,
    traceId: row.traceId,
    durationMs: row.durationMs,
    invokedAt: row.invokedAt,
    responseHash: row.responseHash,
    remoteStatus: "completed",
  };
}

async function cachedReceipt(cacheKey: string, allowExpired = false): Promise<ExecutionReceipt | null> {
  const db = await database();
  if (!db) return null;
  try {
    const row = await db.prepare(`
      SELECT
        execution_mode AS executionMode,
        runtime_name AS runtimeName,
        region,
        trace_id AS traceId,
        duration_ms AS durationMs,
        response_hash AS responseHash,
        invoked_at AS invokedAt,
        expires_at AS expiresAt
      FROM agentcore_runs
      WHERE cache_key = ? AND execution_mode = 'agentcore_live'
      ORDER BY invoked_at DESC
      LIMIT 1
    `).bind(cacheKey).first<CachedReceipt>();
    if (!row) return null;
    if (!allowExpired && Date.parse(row.expiresAt) <= Date.now()) return null;
    return fromCache(row);
  } catch (error) {
    console.warn(JSON.stringify({ event: "agentcore_cache_read_failed", message: error instanceof Error ? error.message : "unknown" }));
    return null;
  }
}

async function liveInvocationsToday(): Promise<number> {
  const db = await database();
  if (!db) return 0;
  try {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const row = await db.prepare(`
      SELECT COUNT(*) AS count
      FROM agentcore_runs
      WHERE invoked_at >= ?
    `).bind(start.toISOString()).first<{ count: number }>();
    return Number(row?.count ?? 0);
  } catch {
    return DAILY_LIVE_LIMIT;
  }
}

async function reserveLiveInvocation(cacheKey: string, caseId: string, sourceHash: string, traceId: string): Promise<string | null> {
  const db = await database();
  if (!db) return null;
  const runId = randomUUID();
  const invokedAt = new Date().toISOString();
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  try {
    const result = await db.prepare(`
      INSERT INTO agentcore_runs (
        run_id, cache_key, case_id, source_hash, execution_mode, runtime_name, region,
        trace_id, duration_ms, response_hash, invoked_at, expires_at
      )
      SELECT ?, ?, ?, ?, 'agentcore_pending', ?, ?, ?, 0, NULL, ?, ?
      WHERE (SELECT COUNT(*) FROM agentcore_runs WHERE invoked_at >= ?) < ?
    `).bind(
      runId,
      cacheKey,
      caseId,
      sourceHash,
      RUNTIME_NAME,
      REGION,
      traceId,
      invokedAt,
      new Date(Date.parse(invokedAt) + CACHE_TTL_MS).toISOString(),
      start.toISOString(),
      DAILY_LIVE_LIMIT,
    ).run();
    return (result.meta.changes ?? 0) === 1 ? runId : null;
  } catch (error) {
    console.error(JSON.stringify({ event: "agentcore_reservation_failed", message: error instanceof Error ? error.message : "unknown" }));
    return null;
  }
}

async function finishLiveInvocation(runId: string, receipt: ExecutionReceipt) {
  const db = await database();
  if (!db || receipt.mode !== "agentcore_live" || !receipt.responseHash) return;
  try {
    await db.prepare(`
      UPDATE agentcore_runs
      SET execution_mode = 'agentcore_live', trace_id = ?, duration_ms = ?,
          response_hash = ?, invoked_at = ?, expires_at = ?
      WHERE run_id = ?
    `).bind(
      receipt.traceId,
      receipt.durationMs,
      receipt.responseHash,
      receipt.invokedAt,
      new Date(Date.parse(receipt.invokedAt) + CACHE_TTL_MS).toISOString(),
      runId,
    ).run();
  } catch (error) {
    console.error(JSON.stringify({ event: "agentcore_receipt_write_failed", message: error instanceof Error ? error.message : "unknown" }));
  }
}

async function failLiveInvocation(runId: string, durationMs: number) {
  const db = await database();
  if (!db) return;
  try {
    await db.prepare(`
      UPDATE agentcore_runs
      SET execution_mode = 'agentcore_failed', duration_ms = ?
      WHERE run_id = ?
    `).bind(durationMs, runId).run();
  } catch {
    console.error(JSON.stringify({ event: "agentcore_failure_receipt_write_failed", runId }));
  }
}

function xrayTraceId() {
  const epoch = Math.floor(Date.now() / 1000).toString(16).padStart(8, "0");
  return `Root=1-${epoch}-${randomBytes(12).toString("hex")}`;
}

function encodeRfc3986(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

function hmac(key: string | Buffer, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function signedAgentCoreRequest(url: string, body: string, sessionId: string, traceId: string, credentials: AgentCoreConfig) {
  const target = new URL(url);
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const date = amzDate.slice(0, 8);
  const credentialScope = `${date}/${REGION}/bedrock-agentcore/aws4_request`;
  const canonicalPath = encodeRfc3986(target.pathname.replace(/\/+/g, "/")).replace(/%2F/g, "/");
  const canonicalQuery = [...target.searchParams.entries()]
    .map(([key, value]) => [encodeRfc3986(key), encodeRfc3986(value)] as const)
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  const signedValues: Array<[string, string]> = [
    ["host", target.host],
    ["x-amz-date", amzDate],
    ["x-amzn-bedrock-agentcore-runtime-session-id", sessionId],
  ];
  if (credentials.sessionToken) signedValues.push(["x-amz-security-token", credentials.sessionToken]);
  signedValues.sort(([left], [right]) => left.localeCompare(right));
  const signedHeaders = signedValues.map(([name]) => name).join(";");
  const canonicalHeaders = signedValues.map(([name, value]) => `${name}:${value.trim().replace(/\s+/g, " ")}`).join("\n");
  const bodyHash = createHash("sha256").update(body).digest("hex");
  const canonicalRequest = ["POST", canonicalPath, canonicalQuery, `${canonicalHeaders}\n`, signedHeaders, bodyHash].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, createHash("sha256").update(canonicalRequest).digest("hex")].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${credentials.secretAccessKey}`, date), REGION), "bedrock-agentcore"), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  const headers = new Headers({
    accept: "application/json",
    "content-type": "application/json",
    "x-amz-date": amzDate,
    "x-amzn-bedrock-agentcore-runtime-session-id": sessionId,
    "x-amzn-trace-id": traceId,
    authorization: `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  });
  if (credentials.sessionToken) headers.set("x-amz-security-token", credentials.sessionToken);
  return new Request(target, { method: "POST", headers, body, signal: AbortSignal.timeout(115_000) });
}

export async function invokeAgentCore(input: {
  caseId: string;
  sourceBundle: string;
  allowLive: boolean;
}): Promise<ExecutionReceipt> {
  if (!input.allowLive) return fallback("Custom text uses the bounded local policy kernel; the public live runtime is restricted to the fixed synthetic fixture.");
  if (input.sourceBundle.length > MAX_SOURCE_LENGTH) return fallback("Source text exceeds the public AgentCore demonstration limit.");

  const sourceHash = createHash("sha256").update(input.sourceBundle).digest("hex");
  const cacheKey = createHash("sha256").update(`${input.caseId}:${sourceHash}:v1`).digest("hex");
  const cached = await cachedReceipt(cacheKey);
  if (cached) return cached;

  const credentials = await config();
  if (!credentials) return fallback("AgentCore live invocation is not enabled on this deployment.");

  if (await liveInvocationsToday() >= DAILY_LIVE_LIMIT) {
    return await cachedReceipt(cacheKey, true) ?? fallback("The public daily AgentCore invocation budget has been reached.");
  }

  const sessionId = `creditbridge-${randomUUID()}`;
  const requestedTraceId = xrayTraceId();
  const reservationId = await reserveLiveInvocation(cacheKey, input.caseId, sourceHash, requestedTraceId);
  if (!reservationId) {
    return await cachedReceipt(cacheKey, true) ?? fallback("The public daily AgentCore invocation budget has been reached.");
  }
  const url = `https://bedrock-agentcore.${REGION}.amazonaws.com/runtimes/${encodeURIComponent(credentials.runtimeArn)}/invocations?qualifier=DEFAULT`;
  const started = Date.now();

  try {
    const body = JSON.stringify({ case_id: input.caseId, source_bundle: input.sourceBundle });
    let response = await fetch(signedAgentCoreRequest(url, body, sessionId, requestedTraceId, credentials));
    if (response.status === 429 || response.status >= 500) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      response = await fetch(signedAgentCoreRequest(url, body, sessionId, requestedTraceId, credentials));
    }
    const responseText = await response.text();
    if (!response.ok) {
      await failLiveInvocation(reservationId, Date.now() - started);
      console.error(JSON.stringify({ event: "agentcore_invoke_failed", status: response.status, traceId: requestedTraceId }));
      return fallback(`AgentCore returned HTTP ${response.status}; deterministic analysis completed instead.`);
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(responseText) as Record<string, unknown>;
    } catch {
      await failLiveInvocation(reservationId, Date.now() - started);
      return fallback("AgentCore returned a non-JSON response; deterministic analysis completed instead.");
    }
    if (parsed.status !== "completed") {
      await failLiveInvocation(reservationId, Date.now() - started);
      return fallback("AgentCore did not return a completed execution receipt.");
    }
    const receipt: ExecutionReceipt = {
      mode: "agentcore_live",
      runtime: RUNTIME_NAME,
      region: REGION,
      traceId: response.headers.get("x-amzn-trace-id") || requestedTraceId,
      durationMs: Date.now() - started,
      invokedAt: new Date().toISOString(),
      responseHash: createHash("sha256").update(responseText).digest("hex"),
      remoteStatus: "completed",
    };
    await finishLiveInvocation(reservationId, receipt);
    console.log(JSON.stringify({ event: "agentcore_invoke_completed", traceId: receipt.traceId, durationMs: receipt.durationMs }));
    return receipt;
  } catch (error) {
    await failLiveInvocation(reservationId, Date.now() - started);
    const kind = error instanceof DOMException && error.name === "TimeoutError" ? "timed out" : "was unavailable";
    console.error(JSON.stringify({ event: "agentcore_invoke_exception", kind, traceId: requestedTraceId }));
    return fallback(`AgentCore ${kind}; deterministic analysis completed instead.`);
  }
}
