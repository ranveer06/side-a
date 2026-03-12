// src/services/spotify.ts – album search and metadata via Spotify Web API
import axios from 'axios';
import { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } from '../config/spotify';
import { supabase } from './supabase';
import { musicBrainzService } from './musicbrainz';

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API_BASE = 'https://api.spotify.com/v1';

let cachedToken: string | null = null;
let tokenExpiry = 0;

/** Standard Base64 encode for ASCII string (client_id:client_secret) */
function base64Encode(str: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  let i = 0;
  const len = str.length;
  while (i + 2 < len) {
    const n = (str.charCodeAt(i) << 16) | (str.charCodeAt(i + 1) << 8) | str.charCodeAt(i + 2);
    out += chars[(n >> 18) & 63] + chars[(n >> 12) & 63] + chars[(n >> 6) & 63] + chars[n & 63];
    i += 3;
  }
  if (i < len) {
    let n = str.charCodeAt(i) << 16;
    if (i + 1 < len) n |= str.charCodeAt(i + 1) << 8;
    out += chars[(n >> 18) & 63] + chars[(n >> 12) & 63];
    out += i + 1 < len ? chars[(n >> 6) & 63] + '=' : '==';
  }
  return out;
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const credentials = base64Encode(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`);

  try {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: 'grant_type=client_credentials',
    });

    const data = await response.json();

    if (!response.ok) {
      const msg = data?.error_description ?? data?.error ?? response.statusText;
      console.error('Spotify token error:', response.status, msg);
      cachedToken = null;
      tokenExpiry = 0;
      throw new Error(msg || `Token request failed: ${response.status}`);
    }

    const token =
      typeof data?.access_token === 'string' && data.access_token.length > 0
        ? data.access_token
        : null;
    if (!token) {
      cachedToken = null;
      tokenExpiry = 0;
      throw new Error('Spotify token response missing access_token');
    }
    cachedToken = token;
    tokenExpiry = Date.now() + ((data.expires_in || 3600) - 60) * 1000;
    return token;
  } catch (err: any) {
    cachedToken = null;
    tokenExpiry = 0;
    if (err?.message) console.error('Spotify token error:', err.message);
    throw err;
  }
}

export interface SpotifySearchResult {
  id: string;
  title: string;
  artist: string;
  date?: string;
  score: number;
  coverArtUrl?: string;
}

export interface SpotifyAlbumDetails {
  id: string;
  title: string;
  artist: string;
  artistId: string;
  date?: string;
  trackCount?: number;
  coverArtUrl?: string;
}

export interface SpotifyTrack {
  track_number: number;
  name: string;
  duration_ms: number;
}

export interface SpotifyArtistDetails {
  id: string;
  name: string;
  genres: string[];
}

export interface SpotifyArtistResult {
  id: string;
  name: string;
  imageUrl?: string;
}

/** Track from search – for rating as individual song (album id is Spotify album id). */
export interface SpotifyTrackSearchResult {
  id: string;
  name: string;
  artist: string;
  albumId: string;
  albumName: string;
  coverArtUrl?: string;
  track_number: number;
  duration_ms: number;
}

/** First non-empty image URL from Spotify (they sometimes return multiple sizes) */
function pickSpotifyImageUrl(images: any[] | undefined): string | undefined {
  if (!images || !Array.isArray(images)) return undefined;
  for (const img of images) {
    const u = img?.url;
    if (typeof u === 'string' && u.startsWith('http')) return u;
  }
  return undefined;
}

function albumToSearchResult(album: any): SpotifySearchResult {
  return {
    id: album.id,
    title: album.name,
    artist: album.artists?.[0]?.name ?? 'Unknown Artist',
    date: album.release_date,
    score: 0,
    coverArtUrl: pickSpotifyImageUrl(album.images),
  };
}

export const spotifyService = {
  /**
   * Search for albums by query string.
   * Spotify Search API allows limit 1–10 per request; we paginate with offset to return up to requested total.
   */
  searchAlbums: async (query: string, limit = 20): Promise<SpotifySearchResult[]> => {
    const q = (query || '').trim();
    if (!q) return [];
    const want = Math.min(50, Math.max(1, parseInt(String(Number(limit) || 10), 10) || 10));
    const perPage = 10;
    const all: SpotifySearchResult[] = [];
    let offset = 0;
    try {
      const token = await getAccessToken();
      while (all.length < want) {
        const response = await axios.get(`${API_BASE}/search`, {
          params: {
            q: q,
            type: 'album',
            limit: perPage,
            offset: Math.max(0, Math.floor(offset)),
          },
          headers: { Authorization: `Bearer ${token}` },
        });
        const items = response.data?.albums?.items ?? [];
        for (const a of items) {
          if (all.length >= want) break;
          all.push(albumToSearchResult(a));
        }
        if (items.length < perPage) break;
        offset += perPage;
      }
      return all;
    } catch (error: any) {
      const msg = error.response?.data?.error_description ?? error.response?.data?.error ?? error.message;
      console.error('Spotify search error:', msg, error.response?.status);
      return [];
    }
  },

  /**
   * Search for both albums and tracks in one request. Limit per type is 1–10 (Spotify Search API).
   */
  searchAlbumsAndTracks: async (
    query: string
  ): Promise<{ albums: SpotifySearchResult[]; tracks: SpotifyTrackSearchResult[] }> => {
    const q = (query || '').trim();
    if (!q) return { albums: [], tracks: [] };
    try {
      const token = await getAccessToken();
      const response = await axios.get(`${API_BASE}/search`, {
        params: {
          q: q,
          type: 'album,track',
          limit: 10,
        },
        headers: { Authorization: `Bearer ${token}` },
      });
      const albumItems = response.data?.albums?.items ?? [];
      const trackItems = response.data?.tracks?.items ?? [];
      const albums = albumItems.map((a: any) => albumToSearchResult(a));
      const tracks: SpotifyTrackSearchResult[] = trackItems.map((t: any) => ({
        id: t.id,
        name: t.name,
        artist: t.artists?.[0]?.name ?? 'Unknown Artist',
        albumId: t.album?.id ?? '',
        albumName: t.album?.name ?? '',
        coverArtUrl: pickSpotifyImageUrl(t.album?.images),
        track_number: t.track_number ?? 0,
        duration_ms: t.duration_ms ?? 0,
      }));
      return { albums, tracks };
    } catch (error: any) {
      const msg = error.response?.data?.error?.message ?? error.response?.data?.error ?? error.message;
      console.error('Spotify search error:', msg, error.response?.status);
      return { albums: [], tracks: [] };
    }
  },

  /**
   * Album search that also pulls in albums by matching artists so keywords like
   * "album name artist name" or just "artist" still show relevant albums.
   */
  searchAlbumsWithKeywords: async (query: string, limit = 50): Promise<SpotifySearchResult[]> => {
    const q = (query || '').trim();
    if (!q) return [];
    const albumResults = await spotifyService.searchAlbums(q, limit);
    const byId = new Map<string, SpotifySearchResult>();
    albumResults.forEach((r) => byId.set(r.id, r));
    if (albumResults.length >= 20) return albumResults;
    try {
      const artists = await spotifyService.searchArtists(q, 5);
      for (const artist of artists.slice(0, 3)) {
        const albums = await spotifyService.getArtistAlbums(artist.id, 10);
        albums.forEach((a) => byId.set(a.id, a));
        if (byId.size >= limit) break;
      }
      return [...byId.values()].slice(0, limit);
    } catch (_) {
      return albumResults;
    }
  },

  /**
   * Search for artists by query string
   */
  searchArtists: async (query: string, limit = 20): Promise<SpotifyArtistResult[]> => {
    const q = (query || '').trim();
    if (!q) return [];
    // Spotify Search API only allows limit 0-10.
    const safeLimit = Math.min(10, Math.max(1, parseInt(String(Number(limit) || 5), 10) || 5));
    try {
      const token = await getAccessToken();
      const response = await axios.get(`${API_BASE}/search`, {
        params: {
          q: q,
          type: 'artist',
          limit: safeLimit,
        },
        headers: { Authorization: `Bearer ${token}` },
      });
      const items = response.data?.artists?.items ?? [];
      return items.map((a: any) => ({
        id: a.id,
        name: a.name,
        imageUrl: pickSpotifyImageUrl(a.images),
      }));
    } catch (error: any) {
      const msg = error.response?.data?.error_description ?? error.response?.data?.error ?? error.message;
      console.error('Spotify artist search error:', msg, error.response?.status);
      return [];
    }
  },

  /**
   * Get albums by artist (Spotify artist ID).
   * Spotify allows limit 1–10 per request; we paginate to return up to requested total.
   */
  getArtistAlbums: async (artistId: string, limit = 10): Promise<SpotifySearchResult[]> => {
    const want = Math.min(50, Math.max(1, parseInt(String(Number(limit) || 10), 10) || 10));
    const perPage = 10;
    const all: SpotifySearchResult[] = [];
    let offset = 0;
    try {
      const token = await getAccessToken();
      while (all.length < want) {
        const response = await axios.get(`${API_BASE}/artists/${artistId}/albums`, {
          params: {
            include_groups: 'album,single',
            limit: perPage,
            offset: Math.max(0, Math.floor(offset)),
            market: 'US',
          },
          headers: { Authorization: `Bearer ${token}` },
        });
        const items = response.data?.items ?? [];
        for (const a of items) {
          if (all.length >= want) break;
          all.push(albumToSearchResult(a));
        }
        if (items.length < perPage) break;
        offset += perPage;
      }
      return all;
    } catch (error: any) {
      const msg = error.response?.data?.error?.message ?? error.message;
      console.error('Spotify getArtistAlbums error:', msg, error.response?.status);
      return [];
    }
  },

  /**
   * Fetch valid genre seeds for recommendations (required for seed_genres fallback).
   */
  getAvailableGenreSeeds: async (): Promise<string[]> => {
    try {
      const token = await getAccessToken();
      const response = await axios.get(`${API_BASE}/recommendations/available-genre-seeds`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const list = response.data?.genres;
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  },

  /**
   * Get recommended albums. Tries Spotify's recommendations API first; if it returns 404
   * (deprecated for many apps as of Nov 2024), falls back to "more from artists you've listened to"
   * using getArtistAlbums, or genre-based search.
   */
  getRecommendations: async (
    seedArtistIds: string[],
    limit = 20
  ): Promise<SpotifySearchResult[]> => {
    const safeLimit = Math.min(100, Math.max(1, parseInt(String(Number(limit) || 20), 10) || 20));
    const validArtistIds = (seedArtistIds || [])
      .filter((id) => typeof id === 'string' && /^[0-9A-Za-z]{22}$/.test(id.trim()))
      .slice(0, 5);

    const trySpotifyRecommendations = async (): Promise<SpotifySearchResult[] | null> => {
      try {
        const token = await getAccessToken();
        const params: Record<string, string | number> = {
          limit: safeLimit,
          market: 'US',
        };
        if (validArtistIds.length > 0) {
          params.seed_artists = validArtistIds.join(',');
        } else {
          const genres = await spotifyService.getAvailableGenreSeeds();
          params.seed_genres = genres.length >= 2 ? genres.slice(0, 3).join(',') : 'pop';
        }
        const response = await axios.get(`${API_BASE}/recommendations`, {
          params,
          headers: { Authorization: `Bearer ${token}` },
        });
        const tracks = response.data?.tracks ?? [];
        const byAlbumId = new Map<string, SpotifySearchResult>();
        for (const t of tracks) {
          const a = t.album;
          if (!a?.id) continue;
          if (byAlbumId.has(a.id)) continue;
          byAlbumId.set(a.id, albumToSearchResult(a));
        }
        return [...byAlbumId.values()].slice(0, safeLimit);
      } catch (err: any) {
        if (err.response?.status === 404) return null;
        throw err;
      }
    };

    const apiResult = await trySpotifyRecommendations().catch(() => null);
    if (apiResult && apiResult.length > 0) return apiResult;

    if (validArtistIds.length > 0) {
      const albumsPerArtist = Math.max(2, Math.ceil(safeLimit / validArtistIds.length));
      const byId = new Map<string, SpotifySearchResult>();
      for (const artistId of validArtistIds) {
        try {
          const albums = await spotifyService.getArtistAlbums(artistId, albumsPerArtist);
          albums.forEach((a) => byId.set(a.id, a));
        } catch (_) {}
      }
      const out = [...byId.values()].slice(0, safeLimit);
      if (out.length > 0) return out;
    }

    try {
      const searchResults = await spotifyService.searchAlbums('popular music', Math.min(15, safeLimit));
      return searchResults.slice(0, safeLimit);
    } catch (_) {
      return [];
    }
  },

  /**
   * Get artist by ID (for genres and display).
   */
  getArtist: async (artistId: string): Promise<SpotifyArtistDetails | null> => {
    if (!artistId) return null;
    try {
      const token = await getAccessToken();
      const response = await axios.get(`${API_BASE}/artists/${artistId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const a = response.data;
      return {
        id: a.id,
        name: a.name ?? 'Unknown',
        genres: Array.isArray(a.genres) ? a.genres : [],
      };
    } catch (_) {
      return null;
    }
  },


  /**
   * Get detailed album information by Spotify ID
   */
  getAlbumDetails: async (spotifyId: string): Promise<SpotifyAlbumDetails | null> => {
    try {
      const token = await getAccessToken();
      const response = await axios.get(`${API_BASE}/albums/${spotifyId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const a = response.data;
      let coverArtUrl = pickSpotifyImageUrl(a.images);
      // If Spotify has no image (empty array – happens on some releases / clients), try MusicBrainz + Cover Art Archive
      if (!coverArtUrl && a.name && a.artists?.[0]?.name) {
        try {
          coverArtUrl =
            (await musicBrainzService.getCoverArtUrlByTitleArtist(
              a.name,
              a.artists[0].name
            )) || undefined;
        } catch (_) {
          /* keep undefined */
        }
      }
      return {
        id: a.id,
        title: a.name,
        artist: a.artists?.[0]?.name ?? 'Unknown Artist',
        artistId: a.artists?.[0]?.id ?? '',
        date: a.release_date,
        trackCount: a.total_tracks,
        coverArtUrl,
      };
    } catch (error) {
      console.error('Spotify getAlbumDetails error:', error);
      return null;
    }
  },

  /**
   * Get album track list by Spotify album ID (paginated).
   */
  getAlbumTracks: async (spotifyId: string): Promise<SpotifyTrack[]> => {
    const token = await getAccessToken();
    const all: SpotifyTrack[] = [];
    const pageLimit = 50;
    let offset = 0;
    while (true) {
      const response = await axios.get(`${API_BASE}/albums/${spotifyId}/tracks`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: pageLimit, offset: Math.max(0, Math.floor(offset)) },
      });
      const items = response.data?.items ?? [];
      for (const t of items) {
        all.push({
          track_number: t.track_number ?? all.length + 1,
          name: t.name ?? '',
          duration_ms: t.duration_ms ?? 0,
        });
      }
      if (items.length < pageLimit) break;
      offset += pageLimit;
    }
    return all;
  },

  /**
   * Resolve album in our DB by Spotify ID: use cache or fetch from Spotify and insert.
   * Handles duplicate key (race), retries getAlbumDetails once, so testers can add many albums.
   */
  getOrCacheAlbum: async (spotifyId: string): Promise<any> => {
    const cacheKey = `spotify:${spotifyId}`;

    const { data: cached } = await supabase
      .from('albums')
      .select('*')
      .eq('musicbrainz_id', cacheKey)
      .single();

    if (cached) {
      if (!cached.cover_art_url || String(cached.cover_art_url).trim() === '') {
        try {
          const details = await spotifyService.getAlbumDetails(spotifyId);
          if (details?.coverArtUrl) {
            await supabase
              .from('albums')
              .update({ cover_art_url: details.coverArtUrl })
              .eq('id', cached.id);
            return { ...cached, cover_art_url: details.coverArtUrl };
          }
        } catch (_) {}
      }
      return cached;
    }

    let details = await spotifyService.getAlbumDetails(spotifyId);
    if (!details) {
      await new Promise((r) => setTimeout(r, 400));
      details = await spotifyService.getAlbumDetails(spotifyId);
    }
    if (!details) return null;

    let genre: string | null = null;
    if (details.artistId) {
      try {
        const artist = await spotifyService.getArtist(details.artistId);
        if (artist?.genres?.length) {
          genre = artist.genres[0] ?? null;
        }
      } catch (_) {}
    }

    const payload: Record<string, unknown> = {
      musicbrainz_id: cacheKey,
      title: details.title,
      artist: details.artist,
      artist_mbid: details.artistId,
      release_date: details.date,
      cover_art_url: details.coverArtUrl,
      total_tracks: details.trackCount,
    };
    if (genre != null) payload.genre = genre;

    let { data: newAlbum, error } = await supabase
      .from('albums')
      .insert([payload])
      .select()
      .single();

    if (error) {
      if ((error as any).code === '23505') {
        const { data: existing } = await supabase
          .from('albums')
          .select('*')
          .eq('musicbrainz_id', cacheKey)
          .single();
        return existing;
      }
      if ((error as any).message?.includes('genre') || (error as any).code === '42703') {
        delete payload.genre;
        const retry = await supabase.from('albums').insert([payload]).select().single();
        if (!retry.error) return retry.data;
      }
      console.error('Error caching Spotify album:', error);
      return null;
    }
    return newAlbum;
  },

  /**
   * Failproof cover URL: Spotify album search only — identical to Search screen.
   * Cached by normalized title+artist so list scrolls don’t re-hit the API;
   * in-flight dedupe so parallel mounts share one request.
   */
  coverUrlFromSearch: (() => {
    const cache = new Map<string, string | null>();
    const inflight = new Map<string, Promise<string | null>>();

    const key = (title: string, artist: string) =>
      `${(title || '').trim().toLowerCase()}\0${(artist || '').trim().toLowerCase()}`;

    async function fetchSearchCover(title: string, artist: string): Promise<string | null> {
      const t = (title || '').trim();
      const a = (artist || '').trim();
      if (!t && !a) return null;
      const query = [t, a].filter(Boolean).join(' ').trim();
      if (!query) return null;
      const results = await spotifyService.searchAlbums(query, 10);
      if (!results.length) return null;
      for (const r of results) {
        const u = r.coverArtUrl;
        if (typeof u === 'string' && u.startsWith('http')) return u;
      }
      const firstId = results[0]?.id;
      if (firstId) {
        const details = await spotifyService.getAlbumDetails(firstId);
        const u = details?.coverArtUrl;
        if (typeof u === 'string' && u.startsWith('http')) return u;
      }
      return null;
    }

    return async (title: string, artist: string): Promise<string | null> => {
      const k = key(title, artist);
      if (cache.has(k)) return cache.get(k)!;
      let p = inflight.get(k);
      if (!p) {
        p = fetchSearchCover(title, artist).then((url) => {
          cache.set(k, url);
          return url;
        });
        inflight.set(k, p);
        p.finally(() => inflight.delete(k));
      }
      return p;
    };
  })(),

  /**
   * Same as coverUrlFromSearch — kept for ensureCoverForAlbum; goes through cache.
   */
  getCoverArtUrlBySearch: async (title: string, artist: string): Promise<string | null> => {
    return spotifyService.coverUrlFromSearch(title, artist);
  },

  /**
   * Force-resolve cover for an existing album row (feed/collection/profile read DB only —
   * getOrCacheAlbum never runs). Updates Supabase and returns URL so UI can refresh.
   *
   * Order: 1) Spotify search by title+artist (same as Search screen) 2) stored spotify/mbid 3) MusicBrainz
   */
  ensureCoverForAlbum: async (albumId: string): Promise<string | null> => {
    const { data: row, error } = await supabase
      .from('albums')
      .select('id, musicbrainz_id, title, artist, cover_art_url')
      .eq('id', albumId)
      .single();
    if (error || !row) return null;
    if (row.cover_art_url && String(row.cover_art_url).trim().length > 0) {
      return row.cover_art_url;
    }
    const mbid = String(row.musicbrainz_id || '');
    let url: string | null | undefined;

    // 1) Always try Spotify search first when we have title + artist — fixes rows with wrong/missing ids
    if (row.title && row.artist) {
      url = await spotifyService.getCoverArtUrlBySearch(row.title, row.artist);
    }

    if (!url && mbid.startsWith('spotify:')) {
      const spotifyId = mbid.slice(8);
      const details = await spotifyService.getAlbumDetails(spotifyId);
      url = details?.coverArtUrl;
    } else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mbid)) {
      url = await musicBrainzService.getCoverArtUrlForReleaseGroup(mbid);
    } else if (mbid.length >= 20 && /^[0-9A-Za-z]+$/.test(mbid)) {
      // Some rows store raw Spotify album id without prefix — same API as Search
      try {
        const details = await spotifyService.getAlbumDetails(mbid);
        url = details?.coverArtUrl;
      } catch (_) {
        /* not a Spotify id */
      }
    }

    if (!url && row.title && row.artist) {
      url = await musicBrainzService.getCoverArtUrlByTitleArtist(row.title, row.artist);
    }

    if (url && url.startsWith('http')) {
      await supabase.from('albums').update({ cover_art_url: url }).eq('id', albumId);
      return url;
    }
    return null;
  },
};
