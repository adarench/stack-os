import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/inngest(.*)",
  "/api/health",
  "/api/vendor/(.*)", // vendor magic-link landing handles its own auth
  "/manifest.webmanifest",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;
  const { userId, orgId } = await auth();
  if (!userId) {
    await auth.protect();
    return;
  }
  // Staff users should always have an active org. If not, send them to org selection.
  if (!orgId && !req.nextUrl.pathname.startsWith("/select-org")) {
    const url = req.nextUrl.clone();
    url.pathname = "/select-org";
    return Response.redirect(url);
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
