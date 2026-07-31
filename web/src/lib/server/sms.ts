import "server-only";
import twilio from "twilio";
import { normalizePhone } from "./phone";

/**
 * Transactional SMS via Twilio. Mirrors email.ts: if Twilio isn't configured
 * (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER), logs + resolves
 * successfully so local dev, tests, and pre-A2P builds never break. Real sends
 * require A2P 10DLC registration (regulatory, 2–4 wk) — once that clears, set
 * the three env vars and this sends for real with no code change.
 */
const sid = process.env.TWILIO_ACCOUNT_SID;
const token = process.env.TWILIO_AUTH_TOKEN;
const from = process.env.TWILIO_FROM_NUMBER;
const client = sid && token ? twilio(sid, token) : null;

export const smsConfigured = (): boolean => !!(client && from);

export interface SendSmsInput {
  to: string;
  body: string;
  /**
   * Optional media to attach — turns the SMS into an MMS (e.g. the resident's
   * repair photos going to the assigned tech). Each must be a publicly
   * fetchable HTTPS URL (signed R2 read URLs qualify). Carriers cap US MMS at
   * 10 items / ~5MB total; the caller enforces that before we get here.
   */
  mediaUrl?: string[];
}

/**
 * Send one SMS (or MMS when `mediaUrl` is present). Returns the Twilio message
 * SID on success (null when stubbed). Real-send errors propagate to the
 * caller's try/catch (which marks the notification failed), matching email.ts.
 */
export async function sendSms(input: SendSmsInput): Promise<{ id: string | null }> {
  // Defense-in-depth: Twilio only accepts E.164. Numbers are normalized on write,
  // but re-normalize here so a legacy/unnormalized row can't cause a hard failure.
  const to = normalizePhone(input.to);
  const media = input.mediaUrl?.filter((u) => /^https:\/\//.test(u)) ?? [];
  if (!client || !from) {
    // eslint-disable-next-line no-console
    console.log("[sms:stub]", to ?? input.to, media.length ? `[+${media.length} media]` : "", input.body.slice(0, 60));
    return { id: null };
  }
  if (!to) return { id: null }; // unsendable number — skip rather than throw
  const msg = await client.messages.create({
    to,
    from,
    body: input.body,
    ...(media.length > 0 ? { mediaUrl: media } : {}),
  });
  return { id: msg.sid };
}
