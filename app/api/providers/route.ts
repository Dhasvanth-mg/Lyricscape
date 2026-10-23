import { handle } from '@/lib/server/http';
import { explainSpotifyCapability, spotifyCapabilities } from '@/lib/player/providers';

export const dynamic = 'force-dynamic';

// Static provider/capability manifest. Whether a *user* is connected to Spotify is client-side
// (PKCE tokens never leave the browser), so this describes what each source can ever do.
export const GET = handle(async () => ({
  providers: [
    { id: 'demo', label: 'Demo (cleared audio)', configured: true, note: 'Original synthesized songs bundled with the app.' },
    { id: 'licensed', label: 'My files (imported)', configured: true, note: 'Audio you import. You are responsible for the rights.' },
    {
      id: 'spotify',
      label: 'Spotify',
      configured: !!(process.env.SPOTIFY_CLIENT_ID || process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID),
      note: 'Official OAuth (PKCE). Client ID can also be pasted in Settings.',
      capabilitiesWhenConnected: spotifyCapabilities(true, null),
      limits: {
        queueRead: explainSpotifyCapability('queueRead'),
        audioAnalysis: explainSpotifyCapability('audioAnalysis'),
        djMixing: explainSpotifyCapability('djMixing'),
        videoExport: explainSpotifyCapability('videoExport'),
        artworkCompositing: explainSpotifyCapability('artworkCompositing'),
      },
    },
  ],
}));
