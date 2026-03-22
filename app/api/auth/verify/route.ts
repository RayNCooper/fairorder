import { NextRequest, NextResponse } from "next/server";
import { verifyMagicLinkToken } from "@/lib/magic-link";
import { createSession, setSessionCookie } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=invalid", request.url));
  }

  const user = await verifyMagicLinkToken(token);

  if (!user) {
    return NextResponse.redirect(new URL("/login?error=expired", request.url));
  }

  // Create a real session
  const sessionToken = await createSession(user.id);
  await setSessionCookie(sessionToken);

  // Check if user has any locations (determines onboarding vs dashboard)
  const { db } = await import("@/lib/db");
  const locationCount = await db.location.count({
    where: { userId: user.id },
  });

  if (locationCount === 0) {
    return NextResponse.redirect(new URL("/setup", request.url));
  }

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
