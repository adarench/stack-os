import Link from "next/link";
import { listStaffUsers } from "@/lib/server/properties";
import { smsConfigured } from "@/lib/server/sms";
import { setUserPhoneAction } from "../_actions";

export const dynamic = "force-dynamic";

/**
 * Team — staff users + their mobile numbers for SMS dispatch. A tech only gets
 * a text on a new assignment if a number is on file here (and Twilio is
 * configured, which needs A2P 10DLC registration).
 */
export default async function AdminTeamPage() {
  const [staff, smsOn] = await Promise.all([
    listStaffUsers(),
    Promise.resolve(smsConfigured()),
  ]);

  return (
    <main className="mx-auto max-w-2xl p-4 pb-24">
      <header className="mb-4 flex items-center gap-3">
        <Link href="/work" className="text-sm text-neutral-500">
          ← Back
        </Link>
        <h1 className="text-lg font-semibold">Team</h1>
      </header>

      <div
        className={`mb-4 rounded-md border px-3 py-2 text-xs ${
          smsOn
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-amber-200 bg-amber-50 text-amber-800"
        }`}
      >
        {smsOn ? (
          <>SMS is live. Techs with a number below get a text on each new assignment.</>
        ) : (
          <>
            SMS is <strong>not yet sending</strong> — Twilio isn&rsquo;t configured
            (needs A2P&nbsp;10DLC registration). Numbers entered here are stored and
            will start texting the moment Twilio env vars are set. Email + push
            already work.
          </>
        )}
      </div>

      {staff.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No staff yet — they appear here after their first sign-in.
        </p>
      ) : (
        <ul className="space-y-2">
          {staff.map((u) => (
            <li
              key={u.id}
              className="rounded border border-neutral-200 bg-white p-3"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{u.name ?? u.email}</span>
                <span className="text-xs text-neutral-500">{u.email}</span>
              </div>
              <form
                action={setUserPhoneAction}
                className="mt-2 flex items-center gap-2 text-sm"
              >
                <input type="hidden" name="userId" value={u.id} />
                <label className="text-xs text-neutral-500">Mobile</label>
                <input
                  name="phone"
                  type="tel"
                  defaultValue={u.phone ?? ""}
                  placeholder="+1 555 555 0123"
                  className="flex-1 rounded border border-neutral-300 px-2 py-1 font-mono text-[13px]"
                />
                <button
                  type="submit"
                  className="rounded border border-neutral-300 px-2 py-1 text-neutral-700 hover:bg-neutral-100"
                >
                  Save
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
