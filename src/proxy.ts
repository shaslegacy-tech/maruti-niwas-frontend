import { NextResponse, type NextRequest } from "next/server";

/** Sends visitors without a session cookie to /login. The API itself enforces roles. */
export function proxy(req: NextRequest) {
  if (req.nextUrl.pathname !== "/login" && !req.cookies.has("mn_token")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|receipt|_next/static|_next/image|favicon.ico).*)"],
};
