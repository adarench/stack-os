import { describe, expect, it, vi } from "vitest";
import { logger, logError, newCorrelationId } from "@/lib/server/logger";

/** Run `fn`, capture the single JSON line the logger emitted, parse it. */
function capture(method: "log" | "warn" | "error", fn: () => void): Record<string, unknown> {
  const spy = vi.spyOn(console, method).mockImplementation(() => {});
  try {
    fn();
    const line = spy.mock.calls.at(-1)?.[0] as string;
    return JSON.parse(line);
  } finally {
    spy.mockRestore();
  }
}

describe("logger redaction", () => {
  it("redacts secret-named keys (top-level and nested), keeps benign fields", () => {
    const rec = capture("log", () =>
      logger.info("evt", {
        password: "hunter2",
        apiKey: "sk-live-123",
        authorization: "Bearer abc",
        cookie: "session=xyz",
        nested: { token: "jwt.a.b", ok: "keep" },
        visibleField: "shown",
      }),
    );
    expect(rec.event).toBe("evt");
    expect(rec.level).toBe("info");
    expect(rec.password).toBe("[redacted]");
    expect(rec.apiKey).toBe("[redacted]");
    expect(rec.authorization).toBe("[redacted]");
    expect(rec.cookie).toBe("[redacted]");
    expect((rec.nested as Record<string, unknown>).token).toBe("[redacted]");
    expect((rec.nested as Record<string, unknown>).ok).toBe("keep");
    expect(rec.visibleField).toBe("shown");
  });

  it("strips the query of a signed URL even under a benign key name", () => {
    const rec = capture("log", () =>
      logger.info("e", {
        fileUrl: "https://bucket.r2.example/photo.jpg?X-Amz-Signature=deadbeef&X-Amz-Credential=AKIA",
      }),
    );
    expect(rec.fileUrl).toBe("https://bucket.r2.example/photo.jpg?[redacted-query]");
  });

  it("truncates over-long strings", () => {
    const long = "a".repeat(2000);
    const rec = capture("log", () => logger.info("e", { blob: long }));
    expect((rec.blob as string).length).toBeLessThan(600);
    expect(rec.blob as string).toMatch(/\[truncated\]$/);
  });

  it("logError returns a correlation id and emits a structured error", () => {
    let id = "";
    const rec = capture("error", () => {
      id = logError("op.failed", new Error("boom"), { workOrderId: "WO-1001" });
    });
    expect(id).toBeTruthy();
    expect(rec.level).toBe("error");
    expect(rec.event).toBe("op.failed");
    expect(rec.correlationId).toBe(id);
    expect(rec.workOrderId).toBe("WO-1001");
    const err = rec.err as Record<string, unknown>;
    expect(err.name).toBe("Error");
    expect(err.message).toBe("boom");
  });

  it("emits warn on the warn channel", () => {
    const rec = capture("warn", () => logger.warn("careful", { a: 1 }));
    expect(rec.level).toBe("warn");
    expect(rec.a).toBe(1);
  });

  it("newCorrelationId returns a non-empty string", () => {
    expect(newCorrelationId().length).toBeGreaterThan(0);
  });
});
