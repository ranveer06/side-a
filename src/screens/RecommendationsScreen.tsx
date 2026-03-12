// Recommendations based on last 5 logged albums (or fewer if not enough)
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { supabase } from '../services/supabase';
import { spotifyService } from '../services/spotify';
import AlbumCover from '../components/AlbumCover';
import { formatAlbumDescription } from '../utils/albumDescription';

export default function RecommendationsScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadRecommendations = React.useCallback(() => {
    let cancelled = false;
    setError(null);
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (!cancelled) {
            setResults([]);
            setLoading(false);
            setRefreshing(false);
          }
          return;
        }
        const { data: logs } = await supabase
          .from('album_logs')
          .select('album_id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10);
        const albumIds = [...new Set((logs ?? []).map((l: any) => l.album_id))].slice(0, 5);
        let artistIds: string[] = [];
        if (albumIds.length > 0) {
          const { data: albums } = await supabase
            .from('albums')
            .select('id, title, artist, musicbrainz_id')
            .in('id', albumIds);
          for (const row of albums ?? []) {
            const mbid = (row.musicbrainz_id || '').toString();
            const spotifyAlbumId = mbid.startsWith('spotify:') ? mbid.slice(8) : /^[0-9A-Za-z]{22}$/.test(mbid) ? mbid : null;
            if (spotifyAlbumId) {
              try {
                const details = await spotifyService.getAlbumDetails(spotifyAlbumId);
                if (details?.artistId && !artistIds.includes(details.artistId)) {
                  artistIds.push(details.artistId);
                }
              } catch (_) {}
            } else if (row.title && row.artist) {
              const searchResults = await spotifyService.searchAlbumsWithKeywords(`${row.title} ${row.artist}`, 1);
              if (searchResults[0]?.id) {
                const details = await spotifyService.getAlbumDetails(searchResults[0].id);
                if (details?.artistId && !artistIds.includes(details.artistId)) {
                  artistIds.push(details.artistId);
                }
              }
            }
            if (artistIds.length >= 5) break;
          }
        }
        const recs = await spotifyService.getRecommendations(artistIds, 25);
        if (!cancelled) setResults(recs ?? []);
      } catch (e) {
        console.error('Recommendations load error:', e);
        if (!cancelled) {
          setResults([]);
          setError(e instanceof Error ? e.message : 'Could not load recommendations');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  const onRefresh = () => {
    setRefreshing(true);
    setResults([]);
    setLoading(true);
    loadRecommendations();
  };

  const handleAlbumPress = async (item: any) => {
    const album = await spotifyService.getOrCacheAlbum(item.id);
    if (album) {
      navigation.navigate('AlbumDetail', { albumId: album.id });
    } else {
      Alert.alert('Couldn’t open album', 'Try again later.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Recommended for you</Text>
        <View style={{ width: 24 }} />
      </View>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1DB954" />
          <Text style={styles.loadingText}>Finding recommendations…</Text>
        </View>
      ) : results.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="musical-notes-outline" size={64} color="#555" />
          <Text style={styles.emptyText}>
            {error ? String(error) : 'Log some albums first, or pull to try again.'}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => { setLoading(true); loadRecommendations(); }}>
            <Text style={styles.retryButtonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1DB954" />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => handleAlbumPress(item)}
              activeOpacity={0.8}
            >
              <AlbumCover
                coverArtUrl={item.coverArtUrl}
                albumId={item.id}
                title={item.title}
                artist={item.artist}
                style={styles.cover}
              />
              <View style={styles.info}>
                <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.artist} numberOfLines={1}>{item.artist}</Text>
                {(() => {
                  const { line, vibe } = formatAlbumDescription({
                    artist: item.artist,
                    release_date: item.date,
                  });
                  if (!line && !vibe) return null;
                  return (
                    <Text style={styles.meta} numberOfLines={1}>
                      {line}{vibe ? ` · ${vibe}` : ''}
                    </Text>
                  );
                })()}
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#999' },
  retryButton: { marginTop: 16, paddingVertical: 10, paddingHorizontal: 20, backgroundColor: '#1DB954', borderRadius: 8 },
  retryButtonText: { color: '#000', fontWeight: '600', fontSize: 14 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, backgroundColor: '#000' },
  emptyText: { marginTop: 12, fontSize: 16, color: '#666', textAlign: 'center' },
  list: { paddingBottom: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  cover: { width: 56, height: 56, borderRadius: 4 },
  info: { flex: 1, marginLeft: 12 },
  title: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 2 },
  artist: { fontSize: 14, color: '#999' },
  meta: { fontSize: 12, color: '#666', marginTop: 2 },
  year: { fontSize: 12, color: '#666', marginTop: 2 },
});
