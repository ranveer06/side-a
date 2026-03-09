// src/services/spotify.ts – album search and metadata via Spotify Web API
import axios from 'axios';
import { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } from '../config/spotify';
import { supabase } from './supabase';

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API_BASE = 'https://api.spotify.com/v1';

let cachedToken: string | null = null;
let tokenExpiry = 0;

function base64Encode(str: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  for (let i = 0; i < str.length; i += 3) {
    const a = str.charCodeAt(i);
    const b = str.charCodeAt(i + 1);
    const c = str.charCodeAt(i + 2);
    const n = (a << 16) | ((b || 0) << 8) | (c || 0);
    output += chars[(n >> 18) & 63] + chars[(n >> 12) & 63] + chars[(n >> 6) & 63] + chars[n & 63];
  }
  const padding = str.length % 3;
  return padding ? output.slice(0, -(3 - padding)) : output;
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const credentials = base64Encode(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`);

  const { data } = await axios.post<{ access_token: string; expires_in: number }>(
    TOKEN_URL,
    'grant_type=client_credentials',
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
    }
  );

  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
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
    try {
      const token = await getAccessToken();
      const response = await axios.get(`${API_BASE}/search`, {
        params: {
          q: query,
          type: 'album',
          limit: Math.min(limit, 50),
        },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const items = response.data?.albums?.items ?? [];
      return items.map(albumToSearchResult);
    } catch (error) {
      console.error('Spotify search error:', error);
      return [];
    }
  },

  /**
   * Search for artists by query string
   */
  searchArtists: async (query: string, limit = 20): Promise<SpotifyArtistResult[]> => {
    try {
      const token = await getAccessToken();
      const response = await axios.get(`${API_BASE}/search`, {
        params: {
          q: query,
          type: 'artist',
          limit: Math.min(limit, 50),
        },
        headers: { Authorization: `Bearer ${token}` },
      });
      const items = response.data?.artists?.items ?? [];
      return items.map((a: any) => ({
        id: a.id,
        name: a.name,
        imageUrl: a.images?.[0]?.url,
      }));
    } catch (error) {
      console.error('Spotify artist search error:', error);
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
