import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import './globals.css';
import './recall-theme.css';

/**
 * One typeface for the interface, one for code. Headings differ from body
 * text by weight and tracking rather than by family. A second display face
 * would add expression the site does not need.
 */
const sans = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://recall-srs-docs.vercel.app'),
  title: {
    default: 'Recall: spaced repetition for React',
    template: '%s · Recall',
  },
  description:
    'A production-grade spaced repetition framework for React and TypeScript. Drop SRS into your education app in minutes instead of rebuilding it.',
  openGraph: {
    type: 'website',
    title: 'Recall: spaced repetition for React',
    description:
      'FSRS and SM-2 behind one interface, headless React components, and swappable storage.',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#08090a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="pt-12">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
