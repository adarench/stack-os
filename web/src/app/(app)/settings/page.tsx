import { redirect } from "next/navigation";

/**
 * There is no dedicated Settings screen yet. Admin & configuration now live in
 * the top-bar account menu (and the mobile "More" sheet); until a real Settings
 * home exists, /settings bounces to the property/unit config page.
 */
export default function SettingsRedirect() {
  redirect("/admin/properties");
}
