/**
 * EML — transactional email template (deep links, escaping, text fallback).
 * Pure/unit; no DB.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderNotificationEmail, absoluteUrl } from "@/lib/server/email-templates";

describe("absoluteUrl", () => {
  const prev = process.env.NEXT_PUBLIC_APP_URL;
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
  });
  afterEach(() => {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = prev;
  });

  it("prefixes a relative path with the configured base", () => {
    expect(absoluteUrl("/tenant/WO-12")).toBe("https://app.example.com/tenant/WO-12");
  });

  it("adds a leading slash when the path lacks one", () => {
    expect(absoluteUrl("my")).toBe("https://app.example.com/my");
  });

  it("passes absolute URLs through untouched", () => {
    expect(absoluteUrl("https://other.test/x")).toBe("https://other.test/x");
  });

  it("does not double a trailing slash on the base", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com/";
    expect(absoluteUrl("/a")).toBe("https://app.example.com/a");
  });
});

describe("renderNotificationEmail", () => {
  it("renders a CTA button to the absolute deep link", () => {
    const { html, text } = renderNotificationEmail({
      heading: "WO-12 → resolved",
      body: "Status changed: in_progress → resolved.",
      url: "https://app.example.com/work-orders/abc",
      ctaLabel: "Open work order",
    });
    expect(html).toContain('href="https://app.example.com/work-orders/abc"');
    expect(html).toContain("Open work order");
    // Text fallback carries the raw link so HTML-stripping clients still work.
    expect(text).toContain("https://app.example.com/work-orders/abc");
    expect(text).toContain("WO-12 → resolved");
  });

  it("omits the button when there is no url", () => {
    const { html } = renderNotificationEmail({ heading: "Hi", body: "No link here." });
    expect(html).not.toContain("<a ");
  });

  it("escapes HTML in heading and body (no injection)", () => {
    const { html } = renderNotificationEmail({
      heading: "<script>alert(1)</script>",
      body: "a & b < c > d \"quote\"",
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp;");
  });

  it("splits blank-line-separated paragraphs into <p> blocks", () => {
    const { html } = renderNotificationEmail({
      heading: "h",
      body: "First para.\n\nSecond para.",
    });
    expect((html.match(/<p /g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});
