export default function TenantInvalid() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center p-6 text-center">
      <h1 className="text-lg font-semibold">Sign-in link is invalid or expired</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Ask your property manager to send a fresh invite.
      </p>
    </main>
  );
}
