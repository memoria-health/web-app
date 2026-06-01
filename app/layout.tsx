import type { Metadata } from 'next';
import { Fraunces, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import '@livekit/components-styles/components';
import '@livekit/components-styles/components/participant';
import '@livekit/components-styles/components/layout';
import '@livekit/components-styles/themes/default';

// Fraunces (serif) — display + titles. The iOS app uses a pre-baked
// SOFT-75 / opsz-144 cut; on web we use the static weights served by
// Google Fonts. Specifying the axes here would force `weight:
// 'variable'`, which removes the static-weight shortcut and bumps
// payload — not worth it for the small SOFT-axis nuance.
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  weight: ['400', '500', '600'],
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
