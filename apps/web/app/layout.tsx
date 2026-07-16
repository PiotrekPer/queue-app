import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, IBM_Plex_Mono, Schibsted_Grotesk } from 'next/font/google';
import './globals.css';

// Google Fonts, subset latin-ext — verify ąćęłńóśźż render (§2).
const display = Bricolage_Grotesque({
  subsets: ['latin-ext'],
  weight: ['700', '800'],
  variable: '--font-bricolage',
  display: 'swap',
});
const ui = Schibsted_Grotesk({
  subsets: ['latin-ext'],
  weight: ['400', '500', '600'],
  variable: '--font-schibsted',
  display: 'swap',
});
const mono = IBM_Plex_Mono({
  subsets: ['latin-ext'],
  weight: ['500', '600'],
  variable: '--font-plex',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Stoliq — system kolejkowy i powiadomienia SMS dla restauracji',
  description:
    'Goście skanują numerek, idą na spacer i wracają dokładnie na swój stolik. Ty prowadzisz kolejkę z telefonu.',
  metadataBase: new URL('https://stq.pl'),
};

export const viewport: Viewport = {
  themeColor: '#F6F1E7',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl" className={`${display.variable} ${ui.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
