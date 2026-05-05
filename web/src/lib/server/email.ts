import "server-only";
import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL ?? "ops@example.com";
const client = apiKey ? new Resend(apiKey) : null;

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send a transactional email via Resend. If RESEND_API_KEY is not set, logs
 * the message to stdout and resolves successfully — useful for local dev and
 * for unblocking P1 before the Resend domain is verified.
 */
export async function sendEmail(input: SendEmailInput): Promise<{ id: string | null }> {
  if (!client) {
    // eslint-disable-next-line no-console
    console.log("[email:stub]", { to: input.to, subject: input.subject, body: input.text ?? input.html });
    return { id: null };
  }
  const result = await client.emails.send({
    from: fromEmail,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
  return { id: result.data?.id ?? null };
}

export const emailConfigured = (): boolean => client !== null;
