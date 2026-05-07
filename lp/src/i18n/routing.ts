import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "ja"],
  defaultLocale: "en",
  // / => en (no prefix), /ja => ja
  localePrefix: "as-needed",
});
