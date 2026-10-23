import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/inter';
import '@fontsource-variable/archivo';
import '@fontsource-variable/jetbrains-mono';
import '@fontsource/anton';
import '@fontsource/dm-serif-display';
import '@fontsource/dm-serif-display/400-italic.css';
import './globals.css';
import { AppShell } from '@/components/shell/AppShell';

export const metadata: Metadata = {
  title: { default: 'Lyricscape', template: '%s · Lyricscape' },
  description: 'A music player with expressive kinetic lyrics, a listening map, and collaborative parties.',
  applicationName: 'Lyricscape',
};

export const viewport: Viewport = {
  themeColor: '#08080a',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
