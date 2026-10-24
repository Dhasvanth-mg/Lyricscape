import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/inter';
import '@fontsource-variable/archivo';
import '@fontsource-variable/jetbrains-mono';
import '@fontsource/anton';
import '@fontsource/dm-serif-display';
import '@fontsource/dm-serif-display/400-italic.css';
import '@fontsource/bangers';
import '@fontsource/permanent-marker';
// art-direction typefaces (only fetched by the browser when a look actually uses them)
import '@fontsource/cormorant-garamond/300.css';
import '@fontsource/cormorant-garamond/300-italic.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/500-italic.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/instrument-serif';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/playfair-display';
import '@fontsource-variable/playfair-display/wght-italic.css';
import '@fontsource-variable/syne';
import '@fontsource/special-elite';
import '@fontsource/bebas-neue';
import '@fontsource/nunito/900.css';
// Hindi (Devanagari) and Tamil faces: the browser only downloads them when lyrics in those scripts are drawn
import '@fontsource-variable/noto-sans-devanagari';
import '@fontsource-variable/noto-sans-tamil';
import '@fontsource/nunito/900-italic.css';
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
