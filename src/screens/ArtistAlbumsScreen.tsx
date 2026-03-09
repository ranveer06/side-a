// src/screens/ArtistAlbumsScreen.tsx – Albums by artist (Spotify)
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spotifyService, type SpotifySearchResult } from '../services/spotify';

export default function ArtistAlbumsScreen({ route, navigation }: any) {
  const { artistId, artistName } = route.params;
  const [albums, setAlbums] = useState<SpotifySearchResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    navigation.setOptions({
      title: artistName || 'Artist',
      headerStyle: { backgroundColor: '#000' },
      headerTintColor: '#fff',
    });
  }, [navigation, artistName]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await spotifyService.getArtistAlbums(artistId, 50);
      if (!cancelled) {
        setAlbums(data);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [artistId]);

  const handleAlbumPress = async (item: SpotifySearchResult) => {
    const album = await spotifyService.getOrCacheAlbum(item.id);
    if (album) navigation.navigate('AlbumDetail', { albumId: album.id });
  };

  const renderItem = ({ item }: { item: SpotifySearchResult }) => (
    <TouchableOpacity style={styles.row} onPress={() => handleAlbumPress(item)}>
      {item.coverArtUrl ? (
        <Image source={{ uri: item.coverArtUrl }} style={styles.cover} />
      ) : (
        <View style={styles.coverPlaceholder}>
          <Ionicons name="disc-outline" size={40} color="#666" />
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        {item.date && (
          <Text style={styles.year}>{new Date(item.date).getFullYear()}</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color="#666" />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  if (albums.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No albums found for this artist</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={albums}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  emptyText: { color: '#999', fontSize: 16 },
  list: { paddingBottom: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  cover: { width: 60, height: 60, borderRadius: 4 },
  coverPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 4,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: { flex: 1, marginLeft: 12 },
  title: { fontSize: 16, fontWeight: '600', color: '#fff' },
  year: { fontSize: 12, color: '#666', marginTop: 2 },
});
