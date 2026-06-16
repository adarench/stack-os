import type { DefaultSession } from "next-auth";

// Expose the stable Google subject id on the session user.
declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
    } & DefaultSession["user"];
  }
}
