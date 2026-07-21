import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Next 16 renamed "middleware" → "proxy". Runs for every matched request.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const role = (user?.app_metadata?.role as string | undefined) ?? undefined;
  const isStaff = role === "owner" || role === "staff";
  const isLogin = request.nextUrl.pathname === "/login";

  // Signed out (or not staff) → only /login is reachable.
  if (!user || !isStaff) {
    if (!isLogin) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    return response;
  }

  // Signed-in staff → keep them out of /login.
  if (isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // __visual is the Playwright screenshot fixture (see src/app/__visual/page.tsx) —
  // it renders no data and must stay reachable without a session so headless
  // browsers can screenshot it; the page's own NODE_ENV check still 404s it in prod.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|__visual|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
