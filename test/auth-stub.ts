/**
 * Test stub for `@/auth` (the Auth.js config). next-auth imports `next/server`,
 * which vitest's node environment can't resolve — and tests never exercise real
 * auth anyway (they mock `@/lib/server/auth`). Aliased in vitest.config.ts so
 * next-auth is never loaded in the test process.
 */
export const handlers = {
  GET: async () => new Response(),
  POST: async () => new Response(),
};
export const signIn = async () => undefined;
export const signOut = async () => undefined;
export const nextAuth = async () => null;
export function emailAllowed(): boolean {
  return true;
}
