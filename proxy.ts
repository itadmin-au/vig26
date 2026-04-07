// proxy.ts
import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { UserRole } from "@/types";

const MANAGEMENT_ROLES: UserRole[] = ["coordinator", "dept_admin", "super_admin"];

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;
    const role = token?.role as UserRole | undefined;

    if (pathname.startsWith("/manage")) {
      if (!token) {
        const loginUrl = new URL("/manage/login", req.url);
        loginUrl.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(loginUrl);
      }
      if (!role || !MANAGEMENT_ROLES.includes(role)) {
        return NextResponse.redirect(new URL("/manage/login?error=Unauthorized", req.url));
      }
    }

    if (pathname.startsWith("/dashboard") || pathname.startsWith("/checkout")) {
      if (!token) {
        const loginUrl = new URL("/auth/login", req.url);
        loginUrl.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(loginUrl);
      }
      if (token.needsOnboarding) {
        return NextResponse.redirect(new URL("/auth/onboarding", req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: () => true,
    },
  }
);

export const config = {
  matcher: [
    "/manage/dashboard/:path*",
    "/manage/events/:path*",
    "/manage/users/:path*",
    "/manage/analytics/:path*",
    "/manage/categories/:path*",
    "/manage/departments/:path*",
    "/dashboard/:path*",
    "/checkout/:path*",
  ],
};