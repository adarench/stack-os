"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { unsubscribePush } from "@/lib/push-client";

/**
 * The field view's only chrome. It had neither a way into the console nor a way
 * out of the session — land here from an SMS deep link and you were stuck on one
 * job with no exit. Mirrors the operator shell's sign-out (unsubscribe push
 * first, so a logged-out phone stops receiving this account's notifications).
 */
export function TechHeaderActions() {
  return (
    <div className="flex items-center gap-3">
      <Link
        href="/my"
        className="text-[12px] font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
      >
        Full console →
      </Link>
      <button
        type="button"
        onClick={async () => {
          await unsubscribePush("/api/me/push/subscribe");
          signOut({ redirectTo: "/sign-in" });
        }}
        className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[12px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <LogOut className="size-3.5" aria-hidden="true" />
        Sign out
      </button>
    </div>
  );
}
