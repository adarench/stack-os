import { redirect } from "next/navigation";

/**
 * Stage A redirect. /settings was a bridge into /admin/*; admin pages are now
 * reached directly from the avatar dropdown. Removed in the next release.
 */
export default function SettingsRedirect() {
  redirect("/admin/properties");
}
