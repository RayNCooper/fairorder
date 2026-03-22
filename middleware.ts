import { NextRequest, NextResponse } from "next/server";

const PROTECTED_PATHS = ["/dashboard", "/setup", "/menu-import", "/complete"];
const AUTH_PATHS = ["/login", "/register"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get("fairorder_session");

  // Protected routes: redirect to login if no session
  const isProtected = PROTECTED_PATHS.some((path) => pathname.startsWith(path));
  if (isProtected && !sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Auth routes: redirect to dashboard if already logged in
  const isAuthRoute = AUTH_PATHS.some((path) => pathname.startsWith(path));
  if (isAuthRoute && sessionCookie) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/setup",
    "/menu-import",
    "/complete",
    "/login",
    "/register",
  ],
};
