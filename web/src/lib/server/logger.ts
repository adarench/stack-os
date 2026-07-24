/**
 * Structured, dependency-free server logger (M0 · OBS-003).
 *
 * Emits one JSON object per line to stdout/stderr, which Vercel captures as
 * structured logs. Runtime-agnostic (Node + Edge): uses only `console`,
 * `process.env`, and `crypto.randomUUID` when available.
 *
 * SECURITY: values are redacted before emit. We never log passwords, tokens,
 * cookies, authorization headers, API keys, VAPID/DSN secrets, S3 storage keys,
 * or signed URLs. This is the single seam an error-tracking vendor (Sentry,
 * OBS-002) hooks into later — see instrumentation.ts.
 *
 * Do NOT put secrets or full PII in the `ctx` you pass; redaction is a safety
 * net, not a license.
 */

type Level = "debug" | "info" | "warn" | "error";
export type LogContext = Record<string, unknown>;

// Key names whose values are always replaced with "[redacted]".
const SECRET_KEY = /(pass(word)?|secret|token|authorization|cookie|api[-_]?key|vapid|dsn|credential|storage[-_]?key|magic|hash|signature|bearer)/i;

const MAX_STRING = 512; // truncate very long strings (defensive)
const MAX_DEPTH = 6;

function looksLikeSignedUrl(s: string): boolean {
  return (
    s.includes("X-Amz-Signature") ||
    s.includes("X-Amz-Credential") ||
    /[?&](signature|sig|token)=/i.test(s)
  );
}

function redactString(s: string): string {
  if (looksLikeSignedUrl(s)) {
    // Keep the path, drop the query (which carries the signature).
    const q = s.indexOf("?");
    return q >= 0 ? `${s.slice(0, q)}?[redacted-query]` : "[redacted-url]";
  }
  return s.length > MAX_STRING ? `${s.slice(0, MAX_STRING)}…[truncated]` : s;
}

function redact(value: unknown, depth = 0): unknown {
  if (value == null) return value;
  if (typeof value === "string") return redactString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
      // Stack is useful and does not normally carry secrets; keep it.
      stack: value.stack,
    };
  }
  if (depth >= MAX_DEPTH) return "[max-depth]";
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((v) => redact(v, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEY.test(k) ? "[redacted]" : redact(v, depth + 1);
    }
    return out;
  }
  return "[unserializable]";
}

function nowIso(): string {
  // `new Date()` is available in Node and Edge app runtimes.
  try {
    return new Date().toISOString();
  } catch {
    return "";
  }
}

function emit(level: Level, event: string, ctx?: LogContext): void {
  const record = {
    ts: nowIso(),
    level,
    event,
    ...(ctx ? (redact(ctx) as LogContext) : {}),
  };
  let line: string;
  try {
    line = JSON.stringify(record);
  } catch {
    line = JSON.stringify({ ts: record.ts, level, event, note: "unserializable-context" });
  }
  // eslint-disable-next-line no-console
  if (level === "error") console.error(line);
  // eslint-disable-next-line no-console
  else if (level === "warn") console.warn(line);
  // eslint-disable-next-line no-console
  else console.log(line);
}

/** Generate a short correlation id for tying a log line to a user-facing error. */
export function newCorrelationId(): string {
  try {
    return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 12);
  } catch {
    return Math.random().toString(36).slice(2, 12);
  }
}

export const logger = {
  debug: (event: string, ctx?: LogContext) => emit("debug", event, ctx),
  info: (event: string, ctx?: LogContext) => emit("info", event, ctx),
  warn: (event: string, ctx?: LogContext) => emit("warn", event, ctx),
  error: (event: string, ctx?: LogContext) => emit("error", event, ctx),
};

/** Convenience: log an error with a generated correlation id; returns the id. */
export function logError(event: string, err: unknown, ctx?: LogContext): string {
  const correlationId = newCorrelationId();
  logger.error(event, { correlationId, err, ...ctx });
  return correlationId;
}
