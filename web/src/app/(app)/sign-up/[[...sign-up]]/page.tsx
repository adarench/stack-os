import { SignUp } from "@clerk/nextjs";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <SignUp />
    </main>
  );
}
