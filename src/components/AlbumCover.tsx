/**
 * Failproof album cover: Search screen is the source of truth.
 * 1) If coverArtUrl is valid → use it.
 * 2) If title + artist → Spotify search (cached) — same images as Search, no DB required for display.
 * 3) If albumId → persist search URL to DB in background when we got URL from search.
 * 4) Else albumId-only → ensureCoverForAlbum (still ends with search first server-side).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Image, StyleSheet, ActivityIndicator, ImageStyle } from 'react-native';
import { spotifyService as spotify } from '../services/spotify';
import { supabase } from '../services/supabase';

function validUri(u: string | null | undefined): u is string {
  return typeof u === 'string' && u.trim().length > 0 && u.startsWith('http');
}

const resolvedByAlbumId = new Map<string, string>();
const inflightEnsure = new Map<string, Promise<string | null>>();

function ensureCoverOnce(albumId: string): Promise<string | null> {
  if (resolvedByAlbumId.has(albumId)) {
    return Promise.resolve(resolvedByAlbumId.get(albumId)!);
  }
  let p = inflightEnsure.get(albumId);
  if (!p) {
    p = spotify
      .ensureCoverForAlbum(albumId)
      .then((url) => {
        if (validUri(url)) resolvedByAlbumId.set(albumId, url!);
        return url;
      })
      .finally(() => inflightEnsure.delete(albumId));
    inflightEnsure.set(albumId, p);
  }
  return p;
}

/** Persist URL so next read from DB has it (non-blocking) */
function persistCover(albumId: string, url: string) {
  supabase.from('albums').update({ cover_art_url: url }).eq('id', albumId).then(() => {});
}

interface AlbumCoverProps {
  coverArtUrl?: string | null;
  musicbrainzId?: string | null;
  style: ImageStyle;
  albumId?: string | null;
  /** When set with artist, Spotify search runs first — same as Search screen */
  title?: string | null;
  artist?: string | null;
}

export default function AlbumCover({
  coverArtUrl,
  style,
  albumId,
  title,
  artist,
}: AlbumCoverProps) {
  const [fetchedUrl, setFetchedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const hasTitleArtist =
    typeof title === 'string' &&
    title.trim().length > 0 &&
    typeof artist === 'string' &&
    artist.trim().length > 0;

  useEffect(() => {
    if (validUri(coverArtUrl)) return;

    let cancelled = false;

    // A) Search first when we have title+artist — failproof, same as Search
    if (hasTitleArtist) {
      setLoading(true);
      spotify
        .coverUrlFromSearch(title!, artist!)
        .then((url) => {
          if (cancelled || !validUri(url)) return;
          setFetchedUrl(url!);
          if (albumId) persistCover(String(albumId), url!);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }

    // B) No title/artist — only albumId path (ensureCover still search-first inside)
    if (albumId && String(albumId).trim()) {
      setLoading(true);
      ensureCoverOnce(String(albumId))
        .then((url) => {
          if (!cancelled && validUri(url)) setFetchedUrl(url!);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }

    return undefined;
  }, [coverArtUrl, albumId, hasTitleArtist, title, artist]);

  const [imageError, setImageError] = useState(false);
  const fallbackRequested = useRef(false);

  const handleImageError = useCallback(() => {
    if (!hasTitleArtist || fallbackRequested.current) return;
    fallbackRequested.current = true;
    setImageError(true);
    spotify.coverUrlFromSearch(title!, artist!).then((url) => {
      if (validUri(url)) {
        setFetchedUrl(url!);
        if (albumId) persistCover(String(albumId), url!);
      }
    });
  }, [hasTitleArtist, title, artist, albumId]);

  const displayUrl = imageError ? fetchedUrl : (validUri(coverArtUrl) ? coverArtUrl!.trim() : fetchedUrl);
  if (validUri(displayUrl)) {
    return (
      <Image
        key={displayUrl}
        source={{
          uri: displayUrl,
          headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
        }}
        style={[style, { backgroundColor: '#141414' }]}
        resizeMode="cover"
        onError={hasTitleArtist ? handleImageError : undefined}
      />
    );
  }

  if ((loading || (imageError && hasTitleArtist)) && (hasTitleArtist || albumId)) {
    return (
      <View style={[style, styles.skeleton]}>
        <ActivityIndicator size="small" color="#333" />
      </View>
    );
  }

  return <View style={[style, styles.skeleton]} />;
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#141414',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
});
