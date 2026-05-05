import { clerkMiddleware } from "@clerk/nextjs/server";

// Minimal Clerk middleware — just sets up auth context. Page-level redirects
// happen in /(app)/page.tsx and via the page's own auth() calls.
export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
