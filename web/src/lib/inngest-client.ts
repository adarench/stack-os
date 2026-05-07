// Re-export the Inngest client for use from server-side app code without
// reaching into /web/src/inngest (which holds the function definitions).
// Splitting the import paths keeps the client lightweight in places that
// only emit events.
export { inngest } from "@/inngest/client";
