import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Skip api, the desktop YouTube mini-player host page, _next internals,
  // and static files (anything with a dot). `/player` is a bare route
  // handler (not localized) loaded directly by the desktop app, so it
  // must bypass next-intl's locale rewrite or it 404s.
  matcher: ["/((?!api|player|_next|_vercel|.*\\..*).*)"],
};
