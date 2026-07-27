import type { Metadata } from 'next';
import { Fraunces, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import '@livekit/components-styles/components';
import '@livekit/components-styles/components/participant';
import '@livekit/components-styles/components/layout';
import '@livekit/components-styles/themes/default';

// Fraunces (serif) — display + titles, matched to the iOS app's pre-baked
// SOFT-75 cut. Loaded as the variable font so the SOFT axis is available
// (applied as `font-variation-settings: 'SOFT' 75` on .font-serif in
// globals.css); opsz follows `font-optical-sizing: auto` per text size,
// and wght is still driven by the normal font-weight utilities. This costs
// more than the three static weights, but the softer letterforms are the
// intended, iOS-matching look.
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  axes: ['opsz', 'SOFT', 'WONK'],
  display: 'swap',
});

// Inter (sans) — body text default. Mirrors Inter18pt on iOS.
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

// JetBrains Mono — eyebrows, status badges, numeric values.
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Memoria',
  description: 'Caregiver dashboard',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${fraunces.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink font-sans">
        {children}
      </body>
    </html>
  );
}
