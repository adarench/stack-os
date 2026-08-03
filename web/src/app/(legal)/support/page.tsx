import type { Metadata } from "next";
import {
  Bullets,
  ContactCard,
  DocHeader,
  P,
  Section,
  SubHeading,
  TableOfContents,
} from "../_components";
import { PRODUCT_NAME, SITE_URL, SUPPORT_EMAIL } from "../_config";

const TITLE = "Support";
const DESCRIPTION =
  "Get help with the StackOS resident app — how to submit and track maintenance requests, manage notifications, and reach the team.";
const URL = `${SITE_URL}/support`;

export const metadata: Metadata = {
  title: `${TITLE} · ${PRODUCT_NAME}`,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    siteName: PRODUCT_NAME,
    title: `${TITLE} · ${PRODUCT_NAME}`,
    description: DESCRIPTION,
    url: URL,
  },
  twitter: { card: "summary", title: `${TITLE} · ${PRODUCT_NAME}`, description: DESCRIPTION },
};

const TOC = [
  { id: "contact", label: "Contact us" },
  { id: "getting-started", label: "Getting started" },
  { id: "requests", label: "Maintenance requests" },
  { id: "notifications", label: "Notifications" },
  { id: "account", label: "Account & sign-in" },
];

/**
 * Public support page for the StackOS resident app. Sits in the (legal) route
 * group so it renders with the same public chrome and, crucially, is reachable
 * without authentication — the App Store listing's required Support URL points
 * here, and an Apple reviewer must be able to load it directly.
 */
export default function SupportPage() {
  return (
    <>
      <DocHeader
        title="Support"
        lastUpdated="August 2, 2026"
        intro="StackOS is the resident app for maintenance at your building. This page covers the common questions and how to reach us if you need a hand."
      />

      <TableOfContents items={TOC} />

      <Section id="contact" title="1. Contact us">
        <P>
          The fastest way to get help is email — we read every message and reply
          during business hours (Mountain Time), Monday through Friday.
        </P>
        <ContactCard
          lines={[
            { label: "Support email", value: SUPPORT_EMAIL, href: `mailto:${SUPPORT_EMAIL}` },
            { label: "Hours", value: "Mon–Fri, 9am–5pm MT" },
            { label: "Response time", value: "Within one business day" },
          ]}
        />
        <P>
          For anything urgent that affects safety (gas, flooding, no heat in
          freezing weather, or a security issue), contact your property manager
          or building emergency line directly — don&rsquo;t wait on an app reply.
        </P>
      </Section>

      <Section id="getting-started" title="2. Getting started">
        <P>
          Your property manager creates your account and sends an invite to set a
          password. Once you&rsquo;re in, you&rsquo;ll see your unit and any open
          requests. If you didn&rsquo;t get an invite, email us and we&rsquo;ll
          resend it.
        </P>
      </Section>

      <Section id="requests" title="3. Maintenance requests">
        <SubHeading>Submitting a request</SubHeading>
        <P>
          Tap <strong>New request</strong>, pick a category, describe the issue,
          and optionally add a photo. Submitting routes it straight to the on-site
          team — you don&rsquo;t need to call anyone.
        </P>
        <SubHeading>Tracking a request</SubHeading>
        <Bullets
          items={[
            "Each request shows its current status, from submitted through completed.",
            "You can message the technician right on the request.",
            "When work is finished you'll get a summary and can confirm it's resolved — or reopen it if it isn't.",
          ]}
        />
      </Section>

      <Section id="notifications" title="4. Notifications">
        <P>
          StackOS keeps you posted by email and text message as your request moves
          along. To stop text messages, reply <strong>STOP</strong> to any
          message; reply <strong>START</strong> to opt back in. Email and in-app
          updates continue regardless.
        </P>
      </Section>

      <Section id="account" title="5. Account & sign-in">
        <P>
          Sign in with the email and password your property manager set up. Forgot
          your password? Use <strong>Forgot password</strong> on the sign-in
          screen to reset it. To update your name, phone number, or unit, email
          support or ask your property manager.
        </P>
      </Section>
    </>
  );
}
