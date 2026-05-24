import type { Metadata } from 'next';
import './globals.css';
import '@livekit/components-styles/components';
import '@livekit/components-styles/components/participant';
import '@livekit/components-styles/components/layout';
import '@livekit/components-styles/themes/default';

export const metadata: Metadata = {
  title: 'Nemara',
  description: 'Caregiver dashboard',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-black text-zinc-100">
        {children}
      </body>
    </html>
  );
}
