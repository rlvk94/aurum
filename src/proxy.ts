import { type NextRequest, NextResponse } from "next/server";

const publicPaths = ["/sign-in", "/verify", "/api/auth", "/api/trpc"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = publicPaths.some((path) => pathname.startsWith(path));
  const hasSession = request.cookies.has("better-auth.session_token");

  // Authenticated users visiting auth pages → redirect to dashboard
  if (isPublic && hasSession && (pathname === "/sign-in" || pathname === "/verify")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Unauthenticated users visiting protected pages → redirect to sign-in
  if (!isPublic && !hasSession) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
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
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
