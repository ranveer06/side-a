# Using Spotify’s API (optional)

You’re currently using **MusicBrainz** for album search and metadata.

## Redirect URI for this app (Spotify Dashboard)

When creating your app in the [Spotify Dashboard](https://developer.spotify.com/dashboard), add this **Redirect URI** (Settings → Redirect URIs):

```text
https://auth.expo.io/@ranveer06/side-a
```

Use this same URI in your app when you call `AuthSession.makeRedirectUri()` (or equivalent) for the Authorization Code + PKCE flow. If you change the Expo owner or slug, update the redirect URI in both the Spotify Dashboard and your code. You can also use the **Spotify Web API** for things like:

- **Album search** – search by album/artist name  
- **Album metadata** – title, artist, release date, track list  
- **Cover art** – high‑resolution images (often better than MusicBrainz)  
- **Preview URLs** – 30‑second track previews (if you add playback)

## Getting access

1. Go to [Spotify for Developers](https://developer.spotify.com/) and sign in.  
2. Create an app in the [Dashboard](https://developer.spotify.com/dashboard) to get:
   - **Client ID**
   - **Client Secret** (keep this secret; don’t put it in mobile app code)

## Auth options

- **Client Credentials** – server/server-style apps. You exchange Client ID + Secret for an access token. Best used from a **backend** (e.g. small Node/Express API) that your app calls; the app never sees the secret.  
- **Authorization Code + PKCE** – for mobile/public clients. User logs in with Spotify; you get a token without storing the client secret in the app.  
  - Docs: [Authorization Guide](https://developer.spotify.com/documentation/web-api/concepts/authorization), [PKCE](https://developer.spotify.com/documentation/web-api/tutorials/code-flow-pkce)

## Endpoints that map to what you do with MusicBrainz

- **Search albums**: `GET https://api.spotify.com/v1/search?q=...&type=album`  
- **Get album**: `GET https://api.spotify.com/v1/albums/{id}`  
- **Get album’s cover image**: in the album object, use `images[0].url` (or another size you prefer).

## Suggested approach

- Keep **MusicBrainz** for canonical IDs and detailed metadata if you like.  
- Add a **small backend** that uses Spotify with **Client Credentials** to:
  - Search albums and return results (and optionally merge with MusicBrainz data).
  - Return cover art URLs so the app can display Spotify artwork.  
- Or use **Spotify + PKCE** in the app only for search/display (no backend), and never ship the client secret.

If you add a backend, you can add a `spotify` service in the app that calls your backend instead of calling Spotify directly, so the secret stays on the server.
