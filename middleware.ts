import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/analytics",
  "/upload",
  "/api/records",
  "/api/qa",
  "/api/map-columns",
  "/api/fix-values",
  "/api/detect-dataset",
  "/api/dataset",
];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

const protect = auth.middleware({ loginUrl: "/login" });

export default async function middleware(request: NextRequest) {
  if (!isProtectedPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }
  return protect(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
