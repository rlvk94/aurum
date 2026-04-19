import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "~/server/better-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const h = await headers();
  const cookieHeader = h.get("cookie");
  const session = await auth.api.getSession({ headers: h });

  return NextResponse.json({
    host: h.get("host"),
    xForwardedProto: h.get("x-forwarded-proto"),
    xForwardedHost: h.get("x-forwarded-host"),
    origin: h.get("origin"),
    referer: h.get("referer"),
    cookiePresent: !!cookieHeader,
    cookieNames: cookieHeader
      ?.split(";")
      .map((c) => c.trim().split("=")[0])
      .filter(Boolean),
    sessionPresent: !!session,
    userId: session?.user?.id ?? null,
    deployedCommit: process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown",
  });
}
