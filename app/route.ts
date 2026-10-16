import { NextResponse, type NextRequest } from "next/server";

/** The proxy redirects `/` to the remembered home before this runs; this is only a fallback. */
export function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/enter", request.url));
}
