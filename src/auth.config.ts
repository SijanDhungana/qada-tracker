import type { NextAuthConfig } from "next-auth";

export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/**
 * Edge-safe half of the Auth.js config: no database and no bcryptjs, so it can
 * be imported by middleware. The Credentials provider lives in `src/auth.ts`,
 * which runs on the Node.js runtime.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE,
  },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
      }
      return token;
    },
    session({ session, token }) {
      // JWT claims are typed as `unknown`, so narrow them before use.
      const id = typeof token.id === "string" ? token.id : null;
      if (id) {
        session.user.id = id;
        session.user.username =
          typeof token.username === "string" ? token.username : "";
      }
      return session;
    },
    authorized({ auth, request }) {
      const loggedIn = Boolean(auth?.user?.id);
      const { pathname } = request.nextUrl;
      const isPublic =
        pathname === "/login" || pathname === "/signup";

      if (isPublic) {
        if (loggedIn) {
          return Response.redirect(new URL("/", request.nextUrl));
        }
        return true;
      }

      return loggedIn;
    },
  },
} satisfies NextAuthConfig;
