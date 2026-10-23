# Media rights and consent

Treated as engineering requirements, not UI hints.

- **Demo audio** is synthesized by `scripts/generate-demo-audio.mjs` from nothing (CC0). Lyrics and artwork for the demo songs are original, also CC0.
- **Imported files** stay on the user's device (IndexedDB). The user is responsible for holding the rights. Nothing is uploaded anywhere.
- **Party photos/videos**: uploads need the uploader's explicit *recap consent* (default off) unless the uploader is the host/co-host. Hosts moderate before anything reaches the gallery or the big screen. Rejected, hidden or removed media is excluded from recaps, and eligibility is re-checked when a render job is claimed.
- **Recap soundtracks**: either a bundled CC0 song, or audio the host uploads while ticking *I own this audio or have the rights to use it in a video (including sync rights)*. The attestation is stored with the file and required by the API. Spotify recordings are refused.
- **Provenance**: every saved lyric records its source; every timeline records the soundtrack license string.
- **Metadata**: rendered videos strip source metadata (`-map_metadata -1`), so EXIF/GPS from photos does not travel with a shared recap.
- **Retention**: media of ended parties is deleted after the event's retention window (default 60 days); hosts can delete anything at any time; deleting a party removes its files, jobs and renders.
- **No identity inference**: no face recognition, no emotion/trait inference. Duplicate detection is perceptual hashing and only *suggests* dropping; pinned items always win.
