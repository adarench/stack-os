"use client";

import { SignOutButton } from "@clerk/nextjs";

export function NoAccessSignOut() {
  return (
    <SignOutButton>
      <button className="mt-4 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
        Sign out
      </button>
    </SignOutButton>
  );
}
