import { Page } from "@/components/ui/page";

export default function VendorInvalid() {
  return (
    <Page
      as="main"
      width="narrow"
      className="flex min-h-dvh flex-col items-center justify-center text-center"
    >
      <h1 className="text-lg font-semibold tracking-tight text-foreground">
        Sign-in link is invalid or expired
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Ask your point of contact to send a fresh invite.
      </p>
    </Page>
  );
}
