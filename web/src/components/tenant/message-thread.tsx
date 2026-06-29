import type { TenantMessage } from "@/lib/server/tenant-work-orders";
import { cn } from "@/lib/utils";

/** Chat bubbles — tenant right (filled), team left (muted). */
export function MessageThread({ messages }: { messages: TenantMessage[] }) {
  if (messages.length === 0) {
    return (
      <p className="text-label text-muted-foreground">
        No messages yet. Send one below if there&apos;s anything to add.
      </p>
    );
  }
  return (
    <ul className="space-y-2.5">
      {messages.map((m) => (
        <li key={m.id} className={cn("flex", m.fromTenant ? "justify-end" : "justify-start")}>
          <div
            className={cn(
              "max-w-[82%] rounded-2xl px-3 py-2 text-body",
              m.fromTenant
                ? "rounded-br-sm bg-primary text-primary-foreground"
                : "rounded-bl-sm bg-muted text-foreground",
            )}
          >
            <p className="whitespace-pre-wrap">{m.body}</p>
            <p
              className={cn(
                "mt-0.5 text-meta",
                m.fromTenant ? "text-primary-foreground/70" : "text-muted-foreground",
              )}
            >
              {m.fromTenant ? "You" : "Team"} ·{" "}
              {new Date(m.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
