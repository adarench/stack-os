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
import {
  COMPANY_LEGAL_NAME,
  GOVERNING_LAW,
  LAST_UPDATED,
  PRODUCT_NAME,
  SITE_URL,
} from "../_config";

const TITLE = "Terms of Service";
const DESCRIPTION =
  "The terms governing use of StackOS, the property management operations platform — including consent to receive transactional, operational SMS messages. Reply STOP to opt out, HELP for help. Message and data rates may apply.";
const URL = `${SITE_URL}/terms`;

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
  { id: "acceptance", label: "Acceptance of terms" },
  { id: "service", label: "Description of service" },
  { id: "registration", label: "Account registration" },
  { id: "user-responsibilities", label: "User responsibilities" },
  { id: "acceptable-use", label: "Acceptable use" },
  { id: "roles", label: "Role-specific responsibilities" },
  { id: "sms", label: "SMS / text messaging terms" },
  { id: "intellectual-property", label: "Intellectual property" },
  { id: "warranties", label: "Disclaimer of warranties" },
  { id: "liability", label: "Limitation of liability" },
  { id: "termination", label: "Termination" },
  { id: "governing-law", label: "Governing law" },
  { id: "changes", label: "Changes to these terms" },
  { id: "contact", label: "Contact" },
];

export default function TermsOfServicePage() {
  return (
    <article>
      <DocHeader
        title={TITLE}
        lastUpdated={LAST_UPDATED}
        intro={`These Terms of Service govern your access to and use of ${PRODUCT_NAME}, a property management operations platform operated by ${COMPANY_LEGAL_NAME}. Please read them carefully — by using the Service, you agree to these terms.`}
      />

      <TableOfContents items={TOC} />

      <Section id="acceptance" title="1. Acceptance of Terms">
        <P>
          {`By creating an account, accepting an invitation, or otherwise accessing or using ${PRODUCT_NAME} (the `}
          <strong className="font-medium text-foreground">“Service”</strong>
          {`), you agree to be bound by these Terms of Service and by our Privacy Policy. If you are using the Service on behalf of an organization, you represent that you have authority to bind that organization, and `}
          <strong className="font-medium text-foreground">“you”</strong>
          {` refers to both you and that organization. If you do not agree, do not use the Service.`}
        </P>
      </Section>

      <Section id="service" title="2. Description of Service">
        <P>
          {`${PRODUCT_NAME} provides software for coordinating property-management operations, including maintenance work orders, scheduling, inspections, status updates, and operational communication among property managers, technicians, vendors, and residents. We may add, change, or remove features over time to improve the Service.`}
        </P>
      </Section>

      <Section id="registration" title="3. Account Registration">
        <P>
          Access to the Service is provided through accounts and invitations. You
          agree to provide accurate, current, and complete information, to keep
          it up to date, and to maintain the security of your sign-in
          credentials. You are responsible for all activity that occurs under
          your account. Notify us promptly if you suspect any unauthorized use.
        </P>
      </Section>

      <Section id="user-responsibilities" title="4. User Responsibilities">
        <P>You agree to:</P>
        <Bullets
          items={[
            "Use the Service only for lawful, legitimate property-management purposes.",
            "Provide accurate information in work orders, schedules, inspections, and communications.",
            "Keep your account credentials confidential and secure.",
            "Respect the privacy and rights of other users, including residents, vendors, and staff.",
            "Comply with all applicable laws, regulations, and contractual obligations relevant to your role.",
          ]}
        />
      </Section>

      <Section id="acceptable-use" title="5. Acceptable Use">
        <P>You agree that you will not:</P>
        <Bullets
          items={[
            "Use the Service for any unlawful, fraudulent, harassing, or abusive purpose.",
            "Upload malicious code or attempt to disrupt, overload, or impair the Service.",
            "Attempt to gain unauthorized access to the Service, other accounts, or any systems or networks.",
            "Reverse engineer, copy, or resell the Service except as expressly permitted.",
            "Use the Service to send unsolicited marketing, spam, or messaging unrelated to property operations.",
            "Misrepresent your identity, role, or authority.",
          ]}
        />
      </Section>

      <Section id="roles" title="6. Role-Specific Responsibilities">
        <P>
          Different users hold different responsibilities within the Service.
        </P>

        <SubHeading>Property manager responsibilities</SubHeading>
        <P>
          Property managers are responsible for the accuracy of property and
          unit data, for managing user access within their organization, for
          ensuring that residents and vendors are properly invited and
          authorized, and for confirming that they have a lawful basis and any
          necessary consent to contact residents and vendors through the
          Service, including by SMS.
        </P>

        <SubHeading>Resident responsibilities</SubHeading>
        <P>
          Residents are responsible for submitting accurate maintenance requests
          and information, providing reasonable access for scheduled work, and
          communicating respectfully. Residents may receive operational SMS and
          notifications related to their requests and can opt out of SMS at any
          time by replying STOP.
        </P>

        <SubHeading>Vendor responsibilities</SubHeading>
        <P>
          Vendors are responsible for maintaining accurate availability and
          status information, performing assigned work in accordance with their
          agreements, keeping any required licensing and insurance current, and
          using information accessed through the Service only to perform the
          work assigned to them.
        </P>
      </Section>

      <Section id="sms" title="7. SMS / Text Messaging Terms">
        <Callout title="Consent to transactional SMS">
          <P>
            By creating an account or accepting an invitation to {PRODUCT_NAME},
            users consent to receive transactional SMS messages related to
            property operations, including maintenance requests, scheduling
            updates, technician arrival notifications, work order status changes,
            and other operational communications.
          </P>
          <Bullets
            items={[
              "Message frequency varies.",
              "Message and data rates may apply.",
              <>
                Reply{" "}
                <strong className="font-medium text-foreground">STOP</strong> to
                opt out.
              </>,
              <>
                Reply{" "}
                <strong className="font-medium text-foreground">HELP</strong> for
                assistance.
              </>,
              "Consent to receive SMS messages is not a condition of purchasing any goods or services.",
            ]}
          />
        </Callout>

        <P>
          {`${PRODUCT_NAME} sends SMS for transactional and operational purposes only. We do not use SMS for marketing campaigns, promotional offers, affiliate marketing, political messaging, or lending, and we do not sell or share mobile phone numbers with third parties or affiliates for marketing purposes. SMS is delivered through a third-party messaging provider; carriers are not liable for delayed or undelivered messages.`}
        </P>
      </Section>

      <Section id="intellectual-property" title="8. Intellectual Property">
        <P>
          {`The Service, including its software, design, and content (excluding data you submit), is owned by ${COMPANY_LEGAL_NAME} and its licensors and is protected by intellectual-property laws. We grant you a limited, non-exclusive, non-transferable, revocable license to use the Service for its intended property-management purpose. You retain ownership of the data you submit and grant us the rights necessary to host, process, and display it in order to provide the Service.`}
        </P>
      </Section>

      <Section id="warranties" title="9. Disclaimer of Warranties">
        <P>
          The Service is provided{" "}
          <strong className="font-medium text-foreground">
            &ldquo;as is&rdquo;
          </strong>{" "}
          and{" "}
          <strong className="font-medium text-foreground">
            &ldquo;as available&rdquo;
          </strong>{" "}
          without warranties of any kind, whether express or implied, including
          implied warranties of merchantability, fitness for a particular
          purpose, and non-infringement. We do not warrant that the Service will
          be uninterrupted, error-free, or that messages will always be
          delivered on time.
        </P>
      </Section>

      <Section id="liability" title="10. Limitation of Liability">
        <P>
          {`To the maximum extent permitted by law, ${COMPANY_LEGAL_NAME} and its affiliates will not be liable for any indirect, incidental, special, consequential, or punitive damages, or for any loss of profits, data, or goodwill arising out of or relating to your use of the Service. Our total liability for any claim relating to the Service will not exceed the amount you paid us for the Service in the twelve months preceding the claim, or one hundred U.S. dollars if you paid nothing.`}
        </P>
      </Section>

      <Section id="termination" title="11. Termination">
        <P>
          You may stop using the Service at any time. We may suspend or
          terminate your access if you violate these terms, if required by law,
          or to protect the Service or its users. Upon termination, your right to
          use the Service ends, though certain provisions — including
          intellectual property, disclaimers, limitation of liability, and
          governing law — survive. Operational records may be retained as
          described in our Privacy Policy.
        </P>
      </Section>

      <Section id="governing-law" title="12. Governing Law">
        <P>
          {`These terms are governed by the laws of the ${GOVERNING_LAW}, without regard to its conflict-of-laws rules. You agree that any dispute arising out of or relating to these terms or the Service will be subject to the exclusive jurisdiction of the courts located in that jurisdiction, except where applicable law provides otherwise.`}
        </P>
      </Section>

      <Section id="changes" title="13. Changes to These Terms">
        <P>
          We may update these Terms of Service from time to time. When we make
          material changes, we will revise the &ldquo;Last updated&rdquo; date
          above and, where appropriate, provide additional notice. Your
          continued use of the Service after an update constitutes acceptance of
          the revised terms.
        </P>
      </Section>

      <Section id="contact" title="14. Contact">
        <P>Questions about these Terms of Service? Reach out:</P>
        <ContactCard lines={CONTACT_LINES} />
      </Section>
    </article>
  );
}
