import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { landingPath } from "@/lib/access";
import { LAUNCH_HOME_COOKIE, safeLaunchHome } from "@/lib/launch-home";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
          Object.entries(headers).forEach(([key, value]) => {
            supabaseResponse.headers.set(key, value);
          });
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const pathname = request.nextUrl.pathname;
  const signedIn = Boolean(data?.claims);
  const publicPaths = [
    "/login",
    "/manifest.json",
    "/sw.js",
    "/favicon.ico",
    "/icon.svg",
    "/icon.png",
    "/apple-icon.png",
  ];
  const isPublicPath =
    publicPaths.includes(pathname) ||
    Boolean(pathname.match(/\.(?:svg|png|jpg|jpeg|gif|webp|ico|json|js)$/));

  if (!signedIn && !isPublicPath) {
    return withSession(supabaseResponse, redirectTo(request, "/login"));
  }

  if (signedIn && pathname === "/") {
    const home = safeLaunchHome(request.cookies.get(LAUNCH_HOME_COOKIE)?.value);
    return withSession(supabaseResponse, redirectTo(request, home));
  }

  if (signedIn && pathname === "/login") {
    const { data: access, error: accessError } = await supabase.rpc("get_my_access");
    const home = !accessError && access?.[0] ? landingPath(access[0].pages ?? []) : "/enter";
    return withSession(supabaseResponse, redirectTo(request, home));
  }

  return supabaseResponse;
}

function redirectTo(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  return NextResponse.redirect(url);
}

function withSession(from: NextResponse, to: NextResponse) {
  from.headers.getSetCookie().forEach((cookie) => {
    to.headers.append("set-cookie", cookie);
  });

  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = from.headers.get(header);
    if (value) {
      to.headers.set(header, value);
    }
  }

  return to;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json)$).*)",
  ],
};
