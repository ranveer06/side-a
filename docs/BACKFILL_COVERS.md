# Backfill album covers

Every album row should have `cover_art_url` set so the app never shows a blank cover. This script fills missing covers using:

1. **Spotify album search** – for every row with `title` + `artist`, same query as the in-app Search box (no stored id required). Fixes the “same titles again and again” rows.
2. **Spotify album by id** – for rows with `musicbrainz_id` like `spotify:<id>` (or raw Spotify id).
3. **MusicBrainz + Cover Art Archive** – when Spotify has no image, or for MB UUIDs.

## Requirements

- **Service role key** – Updates to `albums` usually need to bypass RLS. Use the **service_role** key from Supabase (Dashboard → Project Settings → API). **Never commit it** or expose it in the app.

## Run

```bash
cd /path/to/SideA
export SUPABASE_SERVICE_ROLE_KEY="your_service_role_key_here"
npm run backfill-covers
```

Or:

```bash
SUPABASE_SERVICE_ROLE_KEY=... node scripts/backfill-album-covers.cjs
```

## Options

| Env | Default | Description |
|-----|---------|-------------|
| `SUPABASE_SERVICE_ROLE_KEY` | — | **Required** |
| `SUPABASE_URL` | Project URL from app | Optional override |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | Same as `src/config/spotify.ts` | Optional override |
| `DELAY_MS` | `300` | Pause between albums (rate limits) |
| `LIMIT` | none | Max albums to process (testing) |

Example dry run on first 20:

```bash
LIMIT=20 DELAY_MS=500 SUPABASE_SERVICE_ROLE_KEY=... node scripts/backfill-album-covers.cjs
```

## What it does

- **Pass 1:** All rows where `cover_art_url` IS NULL  
- **Pass 2:** All rows where `cover_art_url` is empty string  

For each row it resolves a URL and runs `UPDATE albums SET cover_art_url = ... WHERE id = ...`.

MusicBrainz allows ~1 req/s; the script waits ~1.1s between MB/CAA calls. A large catalog can take a while—use `LIMIT` first to verify, then run without limit overnight if needed.
