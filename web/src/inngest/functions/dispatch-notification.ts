import { inngest } from "../client";
import { dispatchInline } from "@/lib/server/notifications";

interface NotificationEventData {
  orgId: string;
  recipientUserId?: string | null;
  recipientVendorUserId?: string | null;
  kind:
    | "wo_assigned"
    | "wo_blocked"
    | "wo_resolved"
    | "wo_verified"
    | "template_spawned";
  subject: string;
  body: string;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  targetType?:
    | "work_order"
    | "inspection"
    | "inspection_finding"
    | "project"
    | "vendor"
    | "vendor_coi"
    | "tenant_insurance_policy"
    | "task_template"
    | "property"
    | "unit";
  targetId?: string;
}

/**
 * Event-triggered dispatcher: reads notification_preferences for the
 * recipient, sends email via Resend, SMS stub for now (Twilio A2P 10DLC
 * deferred), records a notifications row per channel.
 */
export const dispatchNotification = inngest.createFunction(
  { id: "dispatch-notification" },
  { event: "stack-os/notification.emit" },
  async ({ event, step }) => {
    const data = event.data as NotificationEventData;
    const result = await step.run("dispatch", () => dispatchInline(data));
    return result;
  },
);
