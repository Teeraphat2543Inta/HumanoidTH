import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, isAdminConfigured, verifyAdminBasicAuth, verifyAdminSessionToken } from "./lib/admin-session";

const protectedPrefixes = ["/admin", "/data-pulls"];
const protectedApiPrefixes = ["/api/ingest", "/api/export"];

function isProtectedPath(pathname: string) {
  return protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isProtectedApiPath(pathname: string) {
  return protectedApiPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Protect Web Pages (Redirect to actual UI login page)
  if (isProtectedPath(pathname)) {
    const configured = isAdminConfigured();
    const adminSession = configured ? await verifyAdminSessionToken(request.cookies.get(ADMIN_SESSION_COOKIE)?.value) : null;
    if (!adminSession) {
      const loginUrl = new URL("/admin-login", request.url);
      loginUrl.searchParams.set("from", pathname);
      if (!configured) {
        loginUrl.searchParams.set("error", "not_configured");
      }
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // 2. Protect API Routes (Return 401 JSON without WWW-Authenticate header to prevent browser popups)
  if (isProtectedApiPath(pathname)) {
    if (!isAdminConfigured()) {
      return new NextResponse(JSON.stringify({ error: "Admin access is not configured." }), {
        status: 503,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (verifyAdminBasicAuth(request.headers.get("authorization"))) {
      return NextResponse.next();
    }

    return new NextResponse(JSON.stringify({ error: "Unauthorized. Admin credentials required." }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  return NextResponse.next();
}

export const config = {
  runtime: "nodejs",
  matcher: ["/admin/:path*", "/data-pulls/:path*", "/api/ingest/:path*", "/api/export"]
};
