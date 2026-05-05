import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center p-6 text-center">
      <h1 className="text-2xl font-semibold">Stack OS</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Phase 0 scaffold. Authenticated.
      </p>
    </main>
  );
}
