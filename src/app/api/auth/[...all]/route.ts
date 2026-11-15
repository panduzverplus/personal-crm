import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

// All Better Auth addresses live under /api/auth: the link from the letter
// (/api/auth/magic-link/verify), the session and so on.
export const { GET, POST } = toNextJsHandler(auth);
