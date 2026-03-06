import { NextRequest, NextResponse } from "next/server";
import { defaultLocale, locales } from "./i18n";

export function middleware(request: NextRequest) {
  const locale = request.cookies.get("NEXT_LOCALE")?.value || defaultLocale;

  // Validate locale
  if (!locales.includes(locale as any)) {
    const response = NextResponse.next();
    response.cookies.set("NEXT_LOCALE", defaultLocale);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
