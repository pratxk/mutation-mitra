import type { Metadata, Viewport } from 'next';
import { Noto_Sans_Devanagari } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import './globals.css';

const deva = Noto_Sans_Devanagari({ subsets: ['devanagari', 'latin'], variable: '--font-deva', display: 'swap' });

export const metadata: Metadata = { title: 'म्यूटेशन मित्र', description: 'Mutation Mitra' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export const generateStaticParams = () => routing.locales.map((locale) => ({ locale }));

export default async function RootLayout({ children, params }: { children: React.ReactNode; params: { locale: string } }) {
  if (!routing.locales.includes(params.locale as 'hi' | 'en')) notFound();
  setRequestLocale(params.locale);
  const messages = await getMessages();
  return (
    <html lang={params.locale} className={deva.variable}>
      <body className="font-sans antialiased">
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
