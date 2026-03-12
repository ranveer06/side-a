// Rate a single track (from search) – save to track_logs with album in DB
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { supabase, trackLogService } from '../services/supabase';
import { spotifyService, type SpotifyTrackSearchResult } from '../services/spotify';
import RemoteImage from '../components/RemoteImage';

const REVIEW_MAX = 250;

export default function RateTrackScreen({ route, navigation }: any) {
  const track: SpotifyTrackSearchResult = route.params?.track;
  const [albumId, setAlbumId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [reviewText, setReviewText] = useState('');
  const [existingId, setExistingId] = useState<string | null>(null);

  useEffect(() => {
    if (!track?.albumId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const album = await spotifyService.getOrCacheAlbum(track.albumId);
      if (!cancelled && album?.id) {
        setAlbumId(album.id);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const list = await trackLogService.getForUserAlbum(user.id, album.id).catch(() => []);
          const tl = list.find((l: any) => l.track_number === track.track_number);
          if (tl) {
            setRating(tl.rating ?? null);
            setReviewText((tl.review_text ?? '').slice(0, REVIEW_MAX));
            setExistingId(tl.id);
          }
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [track?.albumId, track?.track_number]);

  const handleSave = async () => {
    if (!albumId || !track) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert('Sign in', 'Sign in to save your rating.');
      return;
    }
    setSaving(true);
    try {
      await trackLogService.upsert({
        user_id: user.id,
        album_id: albumId,
        album_log_id: null,
        track_number: track.track_number,
        track_name: track.name,
        rating: rating ?? undefined,
        review_text: reviewText.trim() || undefined,
      });
      Alert.alert('Saved', 'Your track rating was saved.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  if (!track) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Track not found</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  if (!albumId) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Could not load album</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <RemoteImage uri={track.coverArtUrl} style={styles.cover} placeholderIcon="musical-notes" />
        <Text style={styles.trackName} numberOfLines={2}>{track.name}</Text>
        <Text style={styles.artist}>{track.artist}</Text>
        <Text style={styles.albumName}>from {track.albumName}</Text>
      </View>
      <Text style={styles.sectionTitle}>Your rating</Text>
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => setRating(rating === star ? null : star)}
            hitSlop={8}
          >
            <Ionicons
              name={star <= (rating ?? 0) ? 'star' : 'star-outline'}
              size={36}
              color="#FFD700"
            />
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.sectionTitle}>Note (optional, max {REVIEW_MAX} characters)</Text>
      <TextInput
        style={styles.input}
        placeholder="Add a short note..."
        placeholderTextColor="#666"
        value={reviewText}
        onChangeText={(t) => setReviewText(t.slice(0, REVIEW_MAX))}
        maxLength={REVIEW_MAX}
        multiline
        numberOfLines={3}
      />
      <Text style={styles.charCount}>{reviewText.length}/{REVIEW_MAX}</Text>
      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.saveBtnText}>Save rating</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  errorText: { color: '#999', fontSize: 16 },
  backBtn: { marginTop: 16, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: '#333', borderRadius: 8 },
  backBtnText: { color: '#fff', fontWeight: '600' },
  header: { alignItems: 'center', marginBottom: 24 },
  cover: { width: 160, height: 160, borderRadius: 8, marginBottom: 16 },
  trackName: { fontSize: 22, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
  artist: { fontSize: 16, color: '#999', marginTop: 4 },
  albumName: { fontSize: 14, color: '#666', marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 12 },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: { fontSize: 12, color: '#666', marginTop: 4, marginBottom: 16 },
  saveBtn: {
    backgroundColor: '#1DB954',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 17, fontWeight: '600' },
});
