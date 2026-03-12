// Dedicated tracklist + rate-each-song screen (keeps album detail scroll short)
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Keyboard,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { supabase, trackLogService } from '../services/supabase';
import { spotifyService, type SpotifyTrack } from '../services/spotify';

export default function AlbumTracklistScreen({ route, navigation }: any) {
  const { albumId, albumTitle, albumArtist, userLogId } = route.params ?? {};
  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [tracksLoading, setTracksLoading] = useState(true);
  const [trackLogs, setTrackLogs] = useState<any[]>([]);
  const [trackNoteDrafts, setTrackNoteDrafts] = useState<Record<number, string>>({});

  useEffect(() => {
    navigation.setOptions({
      title: albumTitle ? `Tracklist · ${albumTitle}` : 'Tracklist',
      headerStyle: { backgroundColor: '#000' },
      headerTintColor: '#fff',
    });
  }, [navigation, albumTitle]);

  useEffect(() => {
    if (!albumId) {
      setTracksLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: album } = await supabase.from('albums').select('musicbrainz_id').eq('id', albumId).single();
      const mbid = album?.musicbrainz_id ? String(album.musicbrainz_id) : '';
      const spotifyId = mbid.startsWith('spotify:') ? mbid.slice(8) : (/^[0-9A-Za-z]{22}$/.test(mbid) ? mbid : null);
      if (!spotifyId) {
        if (!cancelled) setTracksLoading(false);
        return;
      }
      try {
        const list = await spotifyService.getAlbumTracks(spotifyId);
        if (!cancelled) setTracks(list);
      } catch (_) {}
      if (!cancelled) setTracksLoading(false);
    })();
    return () => { cancelled = true; };
  }, [albumId]);

  const loadTrackLogs = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !albumId) return;
      const list = await trackLogService.getForUserAlbum(user.id, albumId);
      setTrackLogs(list);
    } catch (_) {
      setTrackLogs([]);
    }
  };

  useEffect(() => {
    if (albumId && tracks.length > 0) loadTrackLogs();
  }, [albumId, tracks.length]);

  const renderStars = (rating: number | null) => (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons
          key={star}
          name={star <= (rating ?? 0) ? 'star' : 'star-outline'}
          size={18}
          color="#FFD700"
        />
      ))}
    </View>
  );

  if (!albumId) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Album not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {tracksLoading ? (
        <View style={styles.loadingBlock}>
          <ActivityIndicator size="large" color="#1DB954" />
          <Text style={styles.loadingText}>Loading tracklist…</Text>
        </View>
      ) : tracks.length === 0 ? (
        <View style={styles.emptyBlock}>
          <Ionicons name="musical-notes-outline" size={48} color="#666" />
          <Text style={styles.emptyText}>No tracklist for this album</Text>
          <Text style={styles.emptySubtext}>Spotify link required</Text>
        </View>
      ) : (
        <>
          <View style={styles.tracklistSection}>
            <Text style={styles.sectionTitle}>Tracklist</Text>
            <View style={styles.tracklist}>
              {tracks.map((t) => (
                <View key={`${t.track_number}-${t.name}`} style={styles.trackRow}>
                  <Text style={styles.trackNumber}>{t.track_number}</Text>
                  <Text style={styles.trackName} numberOfLines={1}>{t.name}</Text>
                  {t.duration_ms > 0 && (
                    <Text style={styles.trackDuration}>
                      {Math.floor(t.duration_ms / 60)}:{(Math.floor((t.duration_ms % 60000) / 1000)).toString().padStart(2, '0')}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          </View>

          <View style={styles.rateSection}>
            <Text style={styles.sectionTitle}>Rate each song (optional)</Text>
            <Text style={styles.hint}>Tap stars to rate · Add a line (max 250 chars) below</Text>
            <View style={styles.ratingsList}>
              {tracks.map((t) => {
                const tl = trackLogs.find((l: any) => l.track_number === t.track_number);
                return (
                  <View key={`rate-${t.track_number}-${t.name}`} style={styles.ratingCard}>
                    <View style={styles.ratingRow}>
                      <Text style={styles.ratingNum}>{t.track_number}</Text>
                      <Text style={styles.ratingName} numberOfLines={1}>{t.name}</Text>
                      <View style={styles.starsWrap}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <TouchableOpacity
                            key={star}
                            onPress={async () => {
                              try {
                                const { data: { user } } = await supabase.auth.getUser();
                                if (!user) {
                                  Alert.alert('Sign in', 'Sign in to save track ratings.');
                                  return;
                                }
                                const newRating = (tl?.rating === star ? null : star) as number | null;
                                await trackLogService.upsert({
                                  user_id: user.id,
                                  album_id: albumId,
                                  album_log_id: userLogId ?? null,
                                  track_number: t.track_number,
                                  track_name: t.name,
                                  rating: newRating,
                                  review_text: tl?.review_text ?? undefined,
                                });
                                loadTrackLogs();
                              } catch (e: any) {
                                Alert.alert('Error', e?.message ?? 'Could not save rating');
                              }
                            }}
                            hitSlop={8}
                          >
                            <Ionicons
                              name={star <= (tl?.rating ?? 0) ? 'star' : 'star-outline'}
                              size={22}
                              color="#FFD700"
                            />
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                    <TextInput
                      style={styles.noteInput}
                      placeholder="Add a line (optional, 250 chars max)"
                      placeholderTextColor="#555"
                      value={trackNoteDrafts[t.track_number] ?? (tl?.review_text ?? '')}
                      onChangeText={(text) => setTrackNoteDrafts((prev) => ({ ...prev, [t.track_number]: text.slice(0, 250) }))}
                      onBlur={async () => {
                        Keyboard.dismiss();
                        const text = (trackNoteDrafts[t.track_number] ?? tl?.review_text ?? '').trim().slice(0, 250);
                        setTrackNoteDrafts((prev) => { const next = { ...prev }; delete next[t.track_number]; return next; });
                        try {
                          const { data: { user } } = await supabase.auth.getUser();
                          if (!user) return;
                          await trackLogService.upsert({
                            user_id: user.id,
                            album_id: albumId,
                            album_log_id: userLogId ?? null,
                            track_number: t.track_number,
                            track_name: t.name,
                            rating: tl?.rating ?? undefined,
                            review_text: text || undefined,
                          });
                          loadTrackLogs();
                        } catch (_) {}
                      }}
                      maxLength={250}
                      multiline
                    />
                    <Text style={styles.charCount}>
                      {(trackNoteDrafts[t.track_number] ?? (tl?.review_text ?? '')).length}/250
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  content: { paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { color: '#999', fontSize: 16 },
  loadingBlock: { paddingVertical: 48, alignItems: 'center' },
  loadingText: { color: '#999', marginTop: 12 },
  emptyBlock: { paddingVertical: 48, alignItems: 'center' },
  emptyText: { color: '#fff', fontSize: 16, marginTop: 12 },
  emptySubtext: { color: '#666', fontSize: 14, marginTop: 4 },
  tracklistSection: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#222' },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 12 },
  tracklist: {},
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    gap: 12,
  },
  trackNumber: { fontSize: 14, color: '#666', width: 28, textAlign: 'right' },
  trackName: { flex: 1, fontSize: 15, color: '#fff' },
  trackDuration: { fontSize: 13, color: '#666' },
  rateSection: { padding: 16 },
  hint: { fontSize: 12, color: '#666', marginTop: 4, marginBottom: 12 },
  ratingsList: {},
  ratingCard: {
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  ratingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  ratingNum: { fontSize: 13, color: '#666', width: 24, textAlign: 'right' },
  ratingName: { flex: 1, fontSize: 14, color: '#ddd' },
  starsWrap: { flexDirection: 'row', gap: 2 },
  starsRow: { flexDirection: 'row', gap: 2 },
  noteInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 6,
    padding: 10,
    color: '#fff',
    fontSize: 14,
    minHeight: 44,
    marginTop: 8,
    textAlignVertical: 'top',
  },
  charCount: { fontSize: 11, color: '#555', marginTop: 4 },
});
