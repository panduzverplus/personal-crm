import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_EXPIRES_IN } from "@/lib/session-config";

// 1. A visitor without the session cookie goes to the login page at once. This is only for
//    convenience: the cookie may be forged or expired, so it is NOT the protection. The real check
//    is `requireUser()` (src/lib/session.ts) on every page with data and in every server action.
// 2. A visitor with the cookie gets it renewed for another 30 days. Better Auth moves the end of
//    the session in the database on a visit, but a Server Component cannot set a cookie, so
//    without this the cookie would die 30 days after the login whatever the visits.

/** Open without a login: the login page, "Ссылка устарела", Better Auth itself and the health check. */
function isPublic(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === "/login/expired" ||
    pathname === "/health" ||
    pathname === "/api/auth" ||
    pathname.startsWith("/api/auth/")
  );
}

// "better-auth.session_token", or with the "__Secure-" prefix when the app is served over https.
const SESSION_COOKIE = /^(__Secure-)?better-auth\.session_token$/;

export function proxy(request: NextRequest) {
  if (isPublic(request.nextUrl.pathname)) {
    return NextResponse.next();
  }
  if (!getSessionCookie(request)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next();
  // A server action may set the cookie itself (Better Auth does, and "Выйти" deletes it), and the
  // renewal here must not come after that.
  if (request.headers.has("next-action")) {
    return response;
  }
  for (const { name, value } of request.cookies.getAll()) {
    if (SESSION_COOKIE.test(name)) {
      // The same attributes as Better Auth gives the cookie at the login.
      response.cookies.set(name, value, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: name.startsWith("__Secure-"),
        maxAge: SESSION_EXPIRES_IN,
      });
    }
  }
  return response;
}

export const config = {
  // Not for build files and images: they have no data.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
