import { redirect } from "next/navigation";

// Google sign-in is also sign-up (no separate flow). Send /sign-up → /sign-in.
export default function Page() {
  redirect("/sign-in");
}
