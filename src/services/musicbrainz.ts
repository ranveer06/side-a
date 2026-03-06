// src/services/musicbrainz.ts
import axios from 'axios';
import { supabase } from './supabase';

const MUSICBRAINZ_API = 'https://musicbrainz.org/ws/2';
const COVERART_API = 'https://coverartarchive.org';

// Rate limiting: MusicBrainz allows 1 request per second
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000;

const delay = async () => {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => 
      setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest)
    );
  }
  lastRequestTime = Date.now();
};

export interface MusicBrainzAlbum {
  id: string;
  title: string;
  artist: string;
  artistId: string;
  date?: string;
  trackCount?: number;
  coverArtUrl?: string;
}

export interface SearchResult {
  id: string;
  title: string;
  artist: string;
  date?: string;
  score: number;
}

export const musicBrainzService = {
  /**
   * Search for albums by query string
   */
  searchAlbums: async (query: string, limit = 10): Promise<SearchResult[]> => {
    await delay();
    
    try {
      const response = await axios.get(`${MUSICBRAINZ_API}/release-group`, {
        params: {
          query: query,
          limit: limit,
          fmt: 'json',
        },
        headers: {
          'User-Agent': 'SideA/1.0.0 (contact@sidea.app)',
        },
      });

      const results = response.data['release-groups'] || [];
      
      return results.map((rg: any) => ({
        id: rg.id,
        title: rg.title,
        artist: rg['artist-credit']?.[0]?.name || 'Unknown Artist',
        date: rg['first-release-date'],
        score: rg.score,
      }));
    } catch (error) {
      console.error('MusicBrainz search error:', error);
      return [];
    }
  },

  /**
   * Get detailed album information by MusicBrainz ID
   */
  getAlbumDetails: async (mbid: string): Promise<MusicBrainzAlbum | null> => {
    await delay();
    
    try {
      // Get release-group details
      const response = await axios.get(`${MUSICBRAINZ_API}/release-group/${mbid}`, {
        params: {
          inc: 'artist-credits+releases',
          fmt: 'json',
        },
        headers: {
          'User-Agent': 'SideA/1.0.0 (contact@sidea.app)',
        },
      });

      const rg = response.data;
      
      // Get the first release to get track count
      let trackCount;
      if (rg.releases && rg.releases.length > 0) {
        const firstRelease = rg.releases[0];
        await delay();
        
        const releaseResponse = await axios.get(
          `${MUSICBRAINZ_API}/release/${firstRelease.id}`,
          {
            params: {
              inc: 'recordings',
              fmt: 'json',
            },
            headers: {
              'User-Agent': 'SideA/1.0.0 (contact@sidea.app)',
            },
          }
        );
        
        trackCount = releaseResponse.data.media?.[0]?.['track-count'];
      }

      // Try to get cover art
      let coverArtUrl;
      try {
        await delay();
        const coverResponse = await axios.get(
          `${COVERART_API}/release-group/${mbid}`,
          {
            headers: {
              'User-Agent': 'SideA/1.0.0 (contact@sidea.app)',
            },
          }
        );
        
        // Get the front cover or first image
        const images = coverResponse.data.images || [];
        const frontCover = images.find((img: any) => img.front === true);
        coverArtUrl = frontCover?.thumbnails?.large || images[0]?.thumbnails?.large;
      } catch (coverError) {
        // Cover art might not be available, that's okay
        console.log('No cover art found for', mbid);
      }

      return {
        id: rg.id,
        title: rg.title,
        artist: rg['artist-credit']?.[0]?.name || 'Unknown Artist',
        artistId: rg['artist-credit']?.[0]?.artist?.id,
        date: rg['first-release-date'],
        trackCount,
        coverArtUrl,
      };
    } catch (error) {
      console.error('Error fetching album details:', error);
      return null;
    }
  },

  /**
   * Cache album in our database or retrieve from cache
   */
  getOrCacheAlbum: async (mbid: string) => {
    // First check if we have it cached
    const { data: cached } = await supabase
      .from('albums')
      .select('*')
      .eq('musicbrainz_id', mbid)
      .single();

    if (cached) {
      return cached;
    }

    // Not cached, fetch from MusicBrainz
    const albumDetails = await musicBrainzService.getAlbumDetails(mbid);
    
    if (!albumDetails) {
      return null;
    }

    // Cache it in our database
    const { data: newAlbum, error } = await supabase
      .from('albums')
      .insert([
        {
          musicbrainz_id: albumDetails.id,
          title: albumDetails.title,
          artist: albumDetails.artist,
          artist_mbid: albumDetails.artistId,
          release_date: albumDetails.date,
          cover_art_url: albumDetails.coverArtUrl,
          total_tracks: albumDetails.trackCount,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error caching album:', error);
      return null;
    }

    return newAlbum;
  },

  /**
   * Search for albums by artist
   */
  searchByArtist: async (artistName: string, limit = 20): Promise<SearchResult[]> => {
    await delay();
    
    try {
      const response = await axios.get(`${MUSICBRAINZ_API}/release-group`, {
        params: {
          query: `artist:"${artistName}"`,
          limit: limit,
          fmt: 'json',
        },
        headers: {
          'User-Agent': 'SideA/1.0.0 (contact@sidea.app)',
        },
      });

      const results = response.data['release-groups'] || [];
      
      return results.map((rg: any) => ({
        id: rg.id,
        title: rg.title,
        artist: rg['artist-credit']?.[0]?.name || 'Unknown Artist',
        date: rg['first-release-date'],
        score: rg.score,
      }));
    } catch (error) {
      console.error('MusicBrainz artist search error:', error);
      return [];
    }
  },
};

