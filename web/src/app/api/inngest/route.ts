import { serve } from "inngest/next";
import { inngest, functions } from "@inngest/index";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [...functions],
});
