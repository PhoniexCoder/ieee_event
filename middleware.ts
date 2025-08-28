
import { NextResponse } from "next/server"

import type { NextRequest } from "next/server"

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Public routes that don't require authentication
  const publicRoutes = ["/", "/api/auth"]

  // Check if the current path is public
  const isPublicRoute = publicRoutes.some((route) => pathname === route || pathname.startsWith(route))

  // Example: check for a session token in cookies (customize as needed)
  const token = req.cookies.get("next-auth.session-token")?.value || req.cookies.get("__Secure-next-auth.session-token")?.value

  // If user is not authenticated and trying to access protected route
  if (!token && !isPublicRoute) {
    return NextResponse.redirect(new URL("/", req.url))
  }

  // If user is authenticated and trying to access login page
  if (token && pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|icon-.*\\.png).*)"],
}
