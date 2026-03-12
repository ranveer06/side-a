/**
 * Backfill album cover_art_url for every row missing a cover.
 * Spotify first, then MusicBrainz + Cover Art Archive.
 *
 * From repo root:
 *   SUPABASE_SERVICE_ROLE_KEY=your_key node scripts/backfill-album-covers.cjs
 *
 * Service role key: Supabase Dashboard → Project Settings → API → service_role (secret).
 * Do not commit the service role key.
 *
 * Optional: DELAY_MS=300  LIMIT=100
 */

const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://cxfrhykvtfhlogodyeep.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '5a99b4a65f3f4b4abd6764ae2c1e20a1';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '357c094112a6412ebca65658fa3fca07';
const DELAY_MS = parseInt(process.env.DELAY_MS || '300', 10);
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : null;

const MB_API = 'https://musicbrainz.org/ws/2';
const CAA_API = 'https://coverartarchive.org';
const SPOTIFY_API = 'https://api.spotify.com/v1';
const UA = 'SideA-Backfill/1.0 (album-cover-backfill)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let spotifyToken = null;
let spotifyExpiry = 0;

async function spotifyTokenGet() {
  if (spotifyToken && Date.now() < spotifyExpiry) return spotifyToken;
  const b64 = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
  const { data } = await axios.post(
    'https://accounts.spotify.com/api/token',
    'grant_type=client_credentials',
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${b64}` } }
  );
  spotifyToken = data.access_token;
  spotifyExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return spotifyToken;
}

function pickImg(images) {
  if (!images || !Array.isArray(images)) return null;
  for (const img of images) {
    if (img && typeof img.url === 'string' && img.url.startsWith('http')) return img.url;
  }
  return null;
}

async function spotifyCover(spotifyId) {
  try {
    const t = await spotifyTokenGet();
    const { data } = await axios.get(`${SPOTIFY_API}/albums/${spotifyId}`, {
      headers: { Authorization: `Bearer ${t}` },
    });
    return pickImg(data.images);
  } catch (e) {
    return null;
  }
}

/** Same as app Search — query by title + artist, no stored id required */
async function spotifySearchCover(title, artist) {
  const q = [title, artist].filter(Boolean).join(' ').trim();
  if (!q) return null;
  try {
    const t = await spotifyTokenGet();
    const { data } = await axios.get(`${SPOTIFY_API}/search`, {
      params: { q, type: 'album', limit: 10 },
      headers: { Authorization: `Bearer ${t}` },
    });
    const items = data?.albums?.items || [];
    for (const album of items) {
      const u = pickImg(album.images);
      if (u) return u;
    }
    if (items[0]?.id) return await spotifyCover(items[0].id);
  } catch (_) {}
  return null;
}

let lastMb = 0;
async function mbWait() {
  const w = Math.max(0, 1100 - (Date.now() - lastMb));
  if (w) await sleep(w);
  lastMb = Date.now();
}

async function caaCover(mbid) {
  try {
    await mbWait();
    const { data, status } = await axios.get(`${CAA_API}/release-group/${mbid}`, {
      headers: { 'User-Agent': UA },
      validateStatus: (s) => s === 200 || s === 404,
    });
    if (status === 404 || !data.images?.length) return null;
    const img = data.images.find((i) => i.front) || data.images[0];
    const u = img.image || img.thumbnails?.large || img.thumbnails?.small;
    return typeof u === 'string' && u.startsWith('http') ? u : null;
  } catch (_) {
    return null;
  }
}

async function mbCoverTitleArtist(title, artist) {
  if (!title || !artist) return null;
  try {
    await mbWait();
    let { data } = await axios.get(`${MB_API}/release-group`, {
      params: { query: `release:"${title}" AND artist:"${artist}"`, limit: 3, fmt: 'json' },
      headers: { 'User-Agent': UA },
    });
    for (const rg of data['release-groups'] || []) {
      const u = await caaCover(rg.id);
      if (u) return u;
    }
    await mbWait();
    ({ data } = await axios.get(`${MB_API}/release-group`, {
      params: { query: `${title} ${artist}`, limit: 3, fmt: 'json' },
      headers: { 'User-Agent': UA },
    }));
    for (const rg of data['release-groups'] || []) {
      const u = await caaCover(rg.id);
      if (u) return u;
    }
  } catch (_) {}
  return null;
}

async function resolveCover(row) {
  // 1) Spotify search by title+artist first — fixes rows with wrong/missing ids (same as app Search)
  if (row.title && row.artist) {
    const u = await spotifySearchCover(row.title, row.artist);
    if (u) return u;
  }
  const mbid = row.musicbrainz_id || '';
  if (mbid.startsWith('spotify:')) {
    const id = mbid.slice(8);
    let u = await spotifyCover(id);
    if (!u) u = await mbCoverTitleArtist(row.title, row.artist);
    return u;
  }
  if (/^[0-9a-f-]{36}$/i.test(mbid)) {
    return await caaCover(mbid);
  }
  return await mbCoverTitleArtist(row.title, row.artist);
}

async function processFilter(supabase, filterIsNull) {
  let offset = 0;
  const page = 50;
  let processed = 0;
  let updated = 0;
  let failed = 0;

  while (true) {
    let q = supabase
      .from('albums')
      .select('id, musicbrainz_id, title, artist, cover_art_url')
      .order('id')
      .range(offset, offset + page - 1);
    if (filterIsNull) q = q.is('cover_art_url', null);
    else q = q.eq('cover_art_url', '');

    const { data: rows, error } = await q;
    if (error) throw error;
    if (!rows?.length) break;

    for (const row of rows) {
      if (LIMIT != null && processed >= LIMIT) return { processed, updated, failed };
      processed++;
      const url = await resolveCover(row);
      if (url) {
        const { error: e2 } = await supabase.from('albums').update({ cover_art_url: url }).eq('id', row.id);
        if (e2) {
          failed++;
          console.warn('update fail', row.id, e2.message);
        } else {
          updated++;
          console.log('OK', row.title);
        }
      } else {
        failed++;
        console.warn('no cover', row.title, row.artist);
      }
      await sleep(DELAY_MS);
    }
    if (rows.length < page) break;
    offset += page;
  }
  return { processed, updated, failed };
}

async function main() {
  if (!SERVICE_KEY) {
    console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  console.log('Pass 1: cover_art_url IS NULL');
  const a = await processFilter(supabase, true);
  console.log('Pass 1 done', a);

  console.log('Pass 2: cover_art_url = empty string');
  const b = await processFilter(supabase, false);
  console.log('Pass 2 done', b);

  console.log('Total updated', a.updated + b.updated, 'still missing', a.failed + b.failed);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
