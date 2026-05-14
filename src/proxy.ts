import { type NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const publicPaths = [
  "/login",
  "/api/auth",
  "/api/trpc",
  "/api/stripe",
  "/api/cron",
  // PWA install assets — must be reachable without a session so the OS can
  // fetch the manifest, app icons, and iOS launch images.
  "/manifest.webmanifest",
  "/api/icons",
  "/api/splash",
  "/icon.svg",
  "/apple-icon",
];
const authRequiredPaths = ["/welcome"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic =
    pathname === "/" ||
    publicPaths.some((path) => pathname.startsWith(path));
  const isAuthRequired = authRequiredPaths.some((path) => pathname.startsWith(path));
  const hasSession = !!getSessionCookie(request);

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
