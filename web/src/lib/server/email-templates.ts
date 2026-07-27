import "server-only";

/**
 * Transactional email rendering (EML — templates + deep links).
 *
 * One branded, table-based, inline-CSS shell that renders reliably across email
 * clients (which strip <style>, ignore CSS variables, and drop flis/grid).
 * Every notification email routes through {@link renderNotificationEmail} so the
 * resident/operator/tech get a consistent, tappable message with a deep link
 * back into the app instead of the old bare `<p>${body}</p>`.
 *
 * Colors are literal hex on purpose: design tokens are CSS custom properties,
 * which email clients don't resolve — so the app's token discipline (which bans
 * Tailwind palette *classes*, not hex) does not apply here.
 */

/** Resolve an absolute URL for a deep link. Emails can't use relative hrefs. */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface NotificationEmailInput {
  /** Bold heading — typically the notification subject. */
  heading: string;
  /** Plain-text body. Blank lines split paragraphs; each line is escaped. */
  body: string;
  /** Optional deep link. Relative paths are made absolute. */
  url?: string | null;
  /** CTA button label (defaults to "View in Stack OS"). Ignored without a url. */
  ctaLabel?: string;
  /** Hidden inbox-preview text. Defaults to the first line of the body. */
  preheader?: string;
}

const BRAND = "Stack OS";
const INK = "#0f172a";
const MUTED = "#64748b";
const BORDER = "#e2e8f0";
const CANVAS = "#f1f5f9";
const ACCENT = "#0f172a";

/**
 * Render a notification email to { html, text }. The HTML is a fixed 600px
 * centered card; the text part is the accessible/plain fallback with the raw
 * link appended so it survives HTML-stripping clients.
 */
export function renderNotificationEmail(input: NotificationEmailInput): {
  html: string;
  text: string;
} {
  const href = input.url ? absoluteUrl(input.url) : null;
  const ctaLabel = input.ctaLabel ?? "View in Stack OS";
  const preheader = (input.preheader ?? input.body.split("\n").find(Boolean) ?? "").slice(0, 140);

  const paragraphs = input.body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:${INK};">${escapeHtml(
          p,
        ).replace(/\n/g, "<br />")}</p>`,
    )
    .join("");

  const button = href
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;">
         <tr><td style="border-radius:8px;background:${ACCENT};">
           <a href="${escapeHtml(href)}" style="display:inline-block;padding:11px 20px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(
             ctaLabel,
           )}</a>
         </td></tr>
       </table>`
    : "";

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><meta name="color-scheme" content="light" /></head>
<body style="margin:0;padding:0;background:${CANVAS};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CANVAS};padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid ${BORDER};border-radius:12px;overflow:hidden;">
        <tr><td style="padding:20px 28px;border-bottom:1px solid ${BORDER};">
          <span style="font-size:14px;font-weight:700;letter-spacing:-0.01em;color:${INK};">${BRAND}</span>
        </td></tr>
        <tr><td style="padding:28px;">
          <h1 style="margin:0 0 16px;font-size:18px;line-height:1.35;font-weight:650;color:${INK};">${escapeHtml(
            input.heading,
          )}</h1>
          ${paragraphs}
          ${button}
        </td></tr>
        <tr><td style="padding:16px 28px;border-top:1px solid ${BORDER};">
          <p style="margin:0;font-size:12px;line-height:1.5;color:${MUTED};">You're receiving this because you're on this work order in ${BRAND}.${
            href ? ` If the button doesn't work, paste this into your browser:<br /><span style="color:${INK};word-break:break-all;">${escapeHtml(href)}</span>` : ""
          }</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [input.heading, "", input.body, href ? `\n${ctaLabel}: ${href}` : ""]
    .join("\n")
    .trim();

  return { html, text };
}
