import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Only the edge-safe config here — no bcryptjs, no database driver.
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
