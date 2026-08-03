import { getMyNotificationPreferences } from "@/lib/server/notification-prefs";
import { Page, PageHeader } from "@/components/ui/page";
import { Panel, SectionHeading } from "@/components/ui/panel";
import { NotificationSettings } from "./_notifications";

export const dynamic = "force-dynamic";

/**
 * Personal settings for the signed-in staff member. Notification opt-outs live
 * here (the dispatch pipeline already honors them); admin/org config stays under
 * /admin.
 */
export default async function SettingsPage() {
  const prefs = await getMyNotificationPreferences();

  return (
    <Page width="default">
      <PageHeader title="Settings" backHref="/work" />

      <Panel className="mb-6">
        <SectionHeading>Notifications</SectionHeading>
        <p className="-mt-1 mb-2 text-label text-muted-foreground">
          Choose how work-order updates reach you. Your in-app inbox always keeps
          the full record; these control what gets pushed to you.
        </p>
        <NotificationSettings initial={prefs} />
      </Panel>
    </Page>
  );
}
