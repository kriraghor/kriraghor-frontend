import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "@kriraghor/ui/i18n/routing";
import { withSharedMessages } from "@kriraghor/ui/i18n/messages";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return {
    locale,
    messages: withSharedMessages(locale, (await import(`../../messages/${locale}.json`)).default),
  };
});
