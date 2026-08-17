import type { Metadata } from "next";
import {
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
  "Support for Stack OS — how to submit maintenance requests, manage notifications, and get technical help.";
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
  { id: "need-help", label: "Need help?" },
  { id: "common-issues", label: "Common issues" },
];

/**
 * Public support page for the Stack OS app. In the (legal) route group so it
 * shares the same public chrome as /privacy and /terms and is reachable without
 * authentication — the App Store listing's required Support URL points here.
 */
export default function SupportPage() {
  return (
    <>
      <DocHeader
        title="Support"
        lastUpdated="August 17, 2026"
        intro="Stack OS helps tenants submit maintenance requests and stay informed throughout the repair process."
      />

      <TableOfContents items={TOC} />

      <Section id="need-help" title="Need help?">
        <P>
          If you are having trouble accessing the app, receiving notifications,
          or submitting a maintenance request, please contact your property
          manager first — they can verify your account and unit.
        </P>
        <SubHeading>Technical support</SubHeading>
        <ContactCard
          lines={[
            { label: "Email", value: SUPPORT_EMAIL, href: `mailto:${SUPPORT_EMAIL}` },
            { label: "Response time", value: "1–2 business days" },
          ]}
        />
      </Section>

      <Section id="common-issues" title="Common issues">
        <SubHeading>I can&rsquo;t log in</SubHeading>
        <P>Contact your property manager to verify your invitation.</P>

        <SubHeading>I am not receiving notifications</SubHeading>
        <P>Ensure notifications are enabled for Stack OS in iOS Settings.</P>

        <SubHeading>My maintenance request isn&rsquo;t updating</SubHeading>
        <P>Status updates are managed by your property&rsquo;s maintenance team.</P>
      </Section>
    </>
  );
}
