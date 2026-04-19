import { type NextRequest, NextResponse } from "next/server";

const publicPaths = ["/login", "/api/auth", "/api/trpc"];
const authRequiredPaths = ["/welcome"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = publicPaths.some((path) => pathname.startsWith(path));
  const isAuthRequired = authRequiredPaths.some((path) => pathname.startsWith(path));
  const hasSession =
    request.cookies.has("better-auth.session_token") ||
    request.cookies.has("__Secure-better-auth.session_token");

  // Authenticated users visiting login → redirect to dashboard
  if (hasSession && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Unauthenticated users visiting auth-required or protected pages → redirect to login
  if (!isPublic && !hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt
     * - public assets
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|aurum-relay/).*)",
  ],
};
