import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const req = await requestLocale;
  const locale = routing.locales.find((l) => l === req) ?? routing.defaultLocale;
  return { locale, messages: (await import(`../messages/${locale}.json`)).default };
});
