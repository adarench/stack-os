import type { Metadata } from "next";
import {
  Bullets,
  Callout,
  ContactCard,
  CONTACT_LINES,
  DocHeader,
  P,
  Section,
  SubHeading,
  TableOfContents,
} from "../_components";
import { LAST_UPDATED, PRIVACY_EMAIL, PRODUCT_NAME, SITE_URL } from "../_config";

const TITLE = "Privacy Policy";
const DESCRIPTION =
  "How Bedrock Work collects, uses, and protects information — including how mobile phone numbers are used solely for transactional, operational property-management SMS and are never shared for marketing.";
const URL = `${SITE_URL}/privacy`;

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
  twitter: {
    card: "summary",
    title: `${TITLE} · ${PRODUCT_NAME}`,
    description: DESCRIPTION,
  },
};

const TOC = [
  { id: "introduction", label: "Introduction" },
  { id: "information-we-collect", label: "Information we collect" },
  { id: "sms", label: "SMS / text messaging" },
  { id: "how-we-use", label: "How we use information" },
  { id: "how-we-share", label: "How we share information" },
  { id: "cookies-analytics", label: "Cookies & analytics" },
  { id: "data-retention", label: "Data retention" },
  { id: "security", label: "Security" },
  { id: "your-rights", label: "Your rights & choices" },
  { id: "childrens-privacy", label: "Children's privacy" },
  { id: "changes", label: "Changes to this policy" },
  { id: "contact", label: "Contact us" },
];

export default function PrivacyPolicyPage() {
  return (
    <article>
      <DocHeader
        title={TITLE}
        lastUpdated={LAST_UPDATED}
        intro={`This Privacy Policy explains what information ${PRODUCT_NAME} collects, how we use it, and the choices you have. ${PRODUCT_NAME} is a property management operations platform used by property managers, maintenance technicians, vendors, and residents to coordinate maintenance work orders, scheduling, inspections, and operational updates.`}
      />

      <TableOfContents items={TOC} />

      <Section id="introduction" title="1. Introduction">
        <P>
          {`This policy applies to the ${PRODUCT_NAME} web application and related services (the `}
          <strong className="font-medium text-foreground">“Service”</strong>
          {`). By using the Service, you agree to the collection and use of information as described here. We collect only what we need to operate property-management workflows, and we do not sell your personal information.`}
        </P>
      </Section>

      <Section id="information-we-collect" title="2. Information We Collect">
        <P>
          We collect information you provide directly, information generated as
          you use the Service, and limited technical information from your
          device.
        </P>

        <SubHeading>Account information</SubHeading>
        <P>
          When an account is created or an invitation is accepted, we collect
          identifying details such as your name, email address, mobile phone
          number, role (for example property manager, technician, vendor, or
          resident), and the organization or properties you are associated
          with.
        </P>

        <SubHeading>Property information</SubHeading>
        <P>
          To coordinate operations, we store information about the properties
          and units managed through the Service, including addresses, unit
          identifiers, assignment and coverage details, and the relationships
          between properties, managers, vendors, and residents.
        </P>

        <SubHeading>Work order and operational data</SubHeading>
        <P>
          The Service records the maintenance and operational data you submit,
          including work order descriptions, scheduling and appointment times,
          status changes, inspection records and checklists, notes and
          comments, and any photos or attachments uploaded to document a job.
        </P>

        <SubHeading>Communications</SubHeading>
        <P>
          When you communicate through the Service or receive notifications, we
          process the content and metadata of those messages — including SMS
          text notifications, email, and in-app messages — so we can deliver
          them and maintain an operational record.
        </P>

        <SubHeading>Device information</SubHeading>
        <P>
          We automatically collect limited technical data when you use the
          Service, such as IP address, browser and device type, operating
          system, log and diagnostic data, and — if you enable push
          notifications — a push subscription token for your device.
        </P>

        <SubHeading>Cookies</SubHeading>
        <P>
          We use strictly necessary cookies and similar technologies to keep
          you signed in, maintain your session, and secure the Service. See
          “Cookies &amp; analytics” below.
        </P>

        <SubHeading>Analytics</SubHeading>
        <P>
          We may use privacy-respecting analytics to understand aggregate usage
          and improve reliability and performance. Analytics data is used in
          aggregate and is not used to send you marketing.
        </P>
      </Section>

      <Section id="sms" title="3. SMS / Text Messaging">
        <P>
          {`${PRODUCT_NAME} uses SMS strictly to support property-management operations. The disclosures below describe how we handle your mobile phone number and the messages we send.`}
        </P>

        <Callout title="Our SMS commitments">
          <Bullets
            items={[
              <>
                <strong className="font-medium text-foreground">
                  Purpose.
                </strong>{" "}
                Mobile phone numbers are collected solely to facilitate property
                management communications.
              </>,
              <>
                <strong className="font-medium text-foreground">
                  Transactional only.
                </strong>{" "}
                SMS is used only for transactional and operational
                notifications — such as work order received, technician
                assigned, appointment scheduled, technician en route, and work
                completed.
              </>,
              <>
                <strong className="font-medium text-foreground">
                  No marketing sharing.
                </strong>{" "}
                We do not sell or share mobile phone numbers with third parties
                or affiliates for marketing purposes.
              </>,
              <>
                <strong className="font-medium text-foreground">
                  Frequency.
                </strong>{" "}
                Message frequency varies depending on account activity.
              </>,
              <>
                <strong className="font-medium text-foreground">
                  Rates.
                </strong>{" "}
                Message and data rates may apply.
              </>,
              <>
                <strong className="font-medium text-foreground">
                  Opt out.
                </strong>{" "}
                You may opt out at any time by replying{" "}
                <strong className="font-medium text-foreground">STOP</strong>.
              </>,
              <>
                <strong className="font-medium text-foreground">Help.</strong>{" "}
                You may reply{" "}
                <strong className="font-medium text-foreground">HELP</strong> for
                assistance.
              </>,
            ]}
          />
        </Callout>

        <P>
          We do not use SMS for marketing campaigns, promotional offers,
          affiliate marketing, political messaging, or lending. Opting out of
          SMS does not remove you from the Service; you may continue to receive
          operational information by email or in the app where available.
        </P>
      </Section>

      <Section id="how-we-use" title="4. How We Use Information">
        <P>We use the information we collect to:</P>
        <Bullets
          items={[
            "Provide, operate, and maintain the Service.",
            "Create and manage accounts, roles, and property associations.",
            "Receive, route, schedule, and track maintenance work orders and inspections.",
            "Send transactional and operational notifications by SMS, email, or in-app messaging.",
            "Maintain accurate operational and historical records for the properties you manage or occupy.",
            "Secure the Service, prevent abuse, and troubleshoot issues.",
            "Comply with legal obligations and enforce our Terms of Service.",
          ]}
        />
      </Section>

      <Section id="how-we-share" title="5. How We Share Information">
        <P>
          We share information only as needed to operate the Service. We do not
          sell personal information, and{" "}
          <strong className="font-medium text-foreground">
            we do not share mobile phone numbers with third parties or
            affiliates for marketing purposes
          </strong>
          .
        </P>

        <SubHeading>Within your organization</SubHeading>
        <P>
          Operational data is shared among the authorized people who need it to
          do the work — for example, a property manager, the assigned
          technician, and the relevant vendor or resident for a given work
          order.
        </P>

        <SubHeading>Service providers</SubHeading>
        <P>
          We use a small set of vetted vendors to run the Service, including a
          messaging provider to deliver SMS (Twilio), an authentication
          provider for secure sign-in (Google), cloud hosting, and database
          infrastructure. These providers process data only on our instructions
          and only to provide their service to us.
        </P>

        <SubHeading>Legal and safety</SubHeading>
        <P>
          We may disclose information if required by law, to respond to legal
          process, to protect the rights, property, or safety of users and the
          public, or in connection with a corporate transaction such as a
          merger or acquisition.
        </P>
      </Section>

      <Section id="cookies-analytics" title="6. Cookies & Analytics">
        <P>
          We use strictly necessary cookies to authenticate sessions and keep
          the Service secure; these cannot be disabled without breaking core
          functionality. Where we use analytics, it is to measure aggregate
          usage and improve performance and reliability. We do not use cookies
          or analytics to build advertising profiles or to send marketing
          messages.
        </P>
      </Section>

      <Section id="data-retention" title="7. Data Retention">
        <P>
          We retain personal and operational information for as long as your
          account is active and as needed to provide the Service, maintain
          accurate property and work-order history, comply with legal and
          recordkeeping obligations, resolve disputes, and enforce our
          agreements. When information is no longer needed, we delete or
          de-identify it. Operational records (such as completed work orders)
          may be retained as part of a property&rsquo;s maintenance history even
          after an individual user account is closed.
        </P>
      </Section>

      <Section id="security" title="8. Security">
        <P>
          We protect information using industry-standard safeguards, including
          encryption in transit, access controls that limit data to authorized
          users within an organization, role-based permissions, and
          row-level data isolation between organizations. No method of
          transmission or storage is perfectly secure, but we work continuously
          to protect your information and to limit access to those who need it.
        </P>
      </Section>

      <Section id="your-rights" title="9. Your Rights & Choices">
        <P>
          Depending on your location, you may have rights regarding your
          personal information. You can:
        </P>
        <Bullets
          items={[
            "Access and review the account information associated with you.",
            "Request correction of inaccurate account information.",
            "Request deletion of your personal information, subject to legal and operational retention requirements.",
            <>
              Opt out of SMS at any time by replying{" "}
              <strong className="font-medium text-foreground">STOP</strong>, or
              reply{" "}
              <strong className="font-medium text-foreground">HELP</strong> for
              assistance.
            </>,
            "Manage push notifications through your device or browser settings.",
          ]}
        />
        <P>
          To exercise any of these rights, contact us at{" "}
          <a
            href={`mailto:${PRIVACY_EMAIL}`}
            className="font-medium text-foreground underline-offset-2 hover:underline"
          >
            {PRIVACY_EMAIL}
          </a>
          . We will respond within a reasonable timeframe and as required by
          applicable law.
        </P>
      </Section>

      <Section id="childrens-privacy" title="10. Children's Privacy">
        <P>
          The Service is intended for use by businesses and adults in a
          property-management context. It is not directed to children, and we do
          not knowingly collect personal information from anyone under 18. If you
          believe a minor has provided us information, contact us and we will
          delete it.
        </P>
      </Section>

      <Section id="changes" title="11. Changes to This Policy">
        <P>
          We may update this Privacy Policy from time to time. When we make
          material changes, we will revise the &ldquo;Last updated&rdquo; date
          at the top of this page and, where appropriate, provide additional
          notice. Your continued use of the Service after an update means you
          accept the revised policy.
        </P>
      </Section>

      <Section id="contact" title="12. Contact Us">
        <P>
          If you have questions about this Privacy Policy or how we handle your
          information, reach out:
        </P>
        <ContactCard lines={CONTACT_LINES} />
      </Section>
    </article>
  );
}
