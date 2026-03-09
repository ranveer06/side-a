// src/services/spotify.ts – album search and metadata via Spotify Web API
import axios from 'axios';
import { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } from '../config/spotify';
import { supabase } from './supabase';

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

    cachedToken = data.access_token;
    tokenExpiry = Date.now() + ((data.expires_in || 3600) - 60) * 1000;
    return cachedToken;
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

export interface SpotifyArtistResult {
  id: string;
  name: string;
  imageUrl?: string;
}

function albumToSearchResult(album: any): SpotifySearchResult {
  return {
    id: album.id,
    title: album.name,
    artist: album.artists?.[0]?.name ?? 'Unknown Artist',
    date: album.release_date,
    score: 0,
    coverArtUrl: album.images?.[0]?.url,
  };
}

export const spotifyService = {
  /**
   * Search for albums by query string
   */
  searchAlbums: async (query: string, limit = 20): Promise<SpotifySearchResult[]> => {
    const q = (query || '').trim();
    if (!q) return [];
    try {
      const token = await getAccessToken();
      const response = await axios.get(`${API_BASE}/search`, {
        params: {
          q: q,
          type: 'album',
          limit: Math.min(Math.max(1, limit), 10),
        },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const items = response.data?.albums?.items ?? [];
      return items.map(albumToSearchResult);
    } catch (error: any) {
      const msg = error.response?.data?.error_description ?? error.response?.data?.error ?? error.message;
      console.error('Spotify search error:', msg, error.response?.status);
      return [];
    }
  },

  /**
   * Search for artists by query string
   */
  searchArtists: async (query: string, limit = 20): Promise<SpotifyArtistResult[]> => {
    const q = (query || '').trim();
    if (!q) return [];
    try {
      const token = await getAccessToken();
      const response = await axios.get(`${API_BASE}/search`, {
        params: {
          q: q,
          type: 'artist',
          limit: Math.min(Math.max(1, limit), 10),
        },
        headers: { Authorization: `Bearer ${token}` },
      });
      const items = response.data?.artists?.items ?? [];
      return items.map((a: any) => ({
        id: a.id,
        name: a.name,
        imageUrl: a.images?.[0]?.url,
      }));
    } catch (error: any) {
      const msg = error.response?.data?.error_description ?? error.response?.data?.error ?? error.message;
      console.error('Spotify artist search error:', msg, error.response?.status);
      return [];
    }
  },

  /**
   * Get albums by artist (Spotify artist ID)
   */
  getArtistAlbums: async (artistId: string, limit = 50): Promise<SpotifySearchResult[]> => {
    try {
      const token = await getAccessToken();
      const response = await axios.get(`${API_BASE}/artists/${artistId}/albums`, {
        params: {
          include_groups: 'album',
          limit: Math.min(limit, 50),
        },
        headers: { Authorization: `Bearer ${token}` },
      });
      const items = response.data?.items ?? [];
      return items.map(albumToSearchResult);
    } catch (error) {
      console.error('Spotify getArtistAlbums error:', error);
      return [];
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
      return {
        id: a.id,
        title: a.name,
        artist: a.artists?.[0]?.name ?? 'Unknown Artist',
        artistId: a.artists?.[0]?.id ?? '',
        date: a.release_date,
        trackCount: a.total_tracks,
        coverArtUrl: a.images?.[0]?.url,
      };
    } catch (error) {
      console.error('Spotify getAlbumDetails error:', error);
      return null;
    }
  },

  /**
   * Resolve album in our DB by Spotify ID: use cache or fetch from Spotify and insert.
   * We store Spotify-sourced rows with musicbrainz_id = 'spotify:' + spotifyId so we don't need a new column.
   */
  getOrCacheAlbum: async (spotifyId: string) => {
    const cacheKey = `spotify:${spotifyId}`;

    const { data: cached } = await supabase
      .from('albums')
      .select('*')
      .eq('musicbrainz_id', cacheKey)
      .single();

    if (cached) return cached;

    const details = await spotifyService.getAlbumDetails(spotifyId);
    if (!details) return null;

    const { data: newAlbum, error } = await supabase
      .from('albums')
      .insert([
        {
          musicbrainz_id: cacheKey,
          title: details.title,
          artist: details.artist,
          artist_mbid: details.artistId,
          release_date: details.date,
          cover_art_url: details.coverArtUrl,
          total_tracks: details.trackCount,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error caching Spotify album:', error);
      return null;
    }
    return newAlbum;
  },
};
