import { handlers } from "@/auth";

// bcryptjs needs Node.js APIs, so pin this route off the Edge runtime.
export const runtime = "nodejs";

export const { GET, POST } = handlers;
