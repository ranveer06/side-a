// src/screens/SearchScreen.tsx - WITH LOGO
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spotifyService, type SpotifySearchResult, type SpotifyArtistResult } from '../services/spotify';

type SearchMode = 'albums' | 'artists';

interface EnrichedSearchResult extends SpotifySearchResult {
  loading?: boolean;
}

export default function SearchScreen({ navigation }: any) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('albums');
  const [results, setResults] = useState<EnrichedSearchResult[]>([]);
  const [artistResults, setArtistResults] = useState<SpotifyArtistResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;

    Keyboard.dismiss();
    setLoading(true);
    setHasSearched(true);

    try {
      if (mode === 'artists') {
        const artists = await spotifyService.searchArtists(query, 20);
        setArtistResults(artists);
        setResults([]);
      } else {
        const searchResults = await spotifyService.searchAlbums(query, 20);
        setResults(searchResults.map(r => ({ ...r, loading: false })));
        setArtistResults([]);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAlbumPress = async (result: EnrichedSearchResult) => {
    const album = await spotifyService.getOrCacheAlbum(result.id);
    if (album) {
      navigation.navigate('AlbumDetail', { albumId: album.id });
    }
  };

  const renderArtistResult = ({ item }: { item: SpotifyArtistResult }) => (
    <TouchableOpacity
      style={styles.resultItem}
      onPress={() => navigation.navigate('ArtistAlbums', { artistId: item.id, artistName: item.name })}
    >
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.artistImage} />
      ) : (
        <View style={styles.albumPlaceholder}>
          <Ionicons name="person" size={40} color="#666" />
        </View>
      )}
      <View style={styles.resultInfo}>
        <Text style={styles.albumTitle} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.artist}>Artist</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#666" />
    </TouchableOpacity>
  );

  const renderSearchResult = ({ item }: { item: EnrichedSearchResult }) => (
    <TouchableOpacity
      style={styles.resultItem}
      onPress={() => handleAlbumPress(item)}
    >
      {item.coverArtUrl ? (
        <Image source={{ uri: item.coverArtUrl }} style={styles.albumCover} />
      ) : item.loading ? (
        <View style={styles.albumPlaceholder}>
          <ActivityIndicator size="small" color="#666" />
        </View>
      ) : (
        <View style={styles.albumPlaceholder}>
          <Ionicons name="disc-outline" size={40} color="#666" />
        </View>
      )}
      <View style={styles.resultInfo}>
        <Text style={styles.albumTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {item.artist}
        </Text>
        {item.date && (
          <Text style={styles.releaseDate}>
            {new Date(item.date).getFullYear()}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color="#666" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Search</Text>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={mode === 'artists' ? 'Search for artists...' : 'Search for albums...'}
            placeholderTextColor="#666"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={styles.searchButton}
          onPress={handleSearch}
          disabled={!query.trim()}
        >
          <Text style={styles.searchButtonText}>Search</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.segmentRow}>
        <TouchableOpacity
          style={[styles.segmentTab, mode === 'albums' && styles.segmentTabActive]}
          onPress={() => { setMode('albums'); setHasSearched(false); setResults([]); setArtistResults([]); }}
        >
          <Text style={[styles.segmentText, mode === 'albums' && styles.segmentTextActive]}>Albums</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentTab, mode === 'artists' && styles.segmentTabActive]}
          onPress={() => { setMode('artists'); setHasSearched(false); setResults([]); setArtistResults([]); }}
        >
          <Text style={[styles.segmentText, mode === 'artists' && styles.segmentTextActive]}>Artists</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#1DB954" />
          <Text style={styles.loadingText}>
            {mode === 'artists' ? 'Searching artists...' : 'Searching albums...'}
          </Text>
        </View>
      ) : hasSearched && mode === 'albums' && results.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="search-outline" size={64} color="#666" />
          <Text style={styles.emptyText}>No albums found</Text>
          <Text style={styles.emptySubtext}>Try different keywords or search by artist</Text>
        </View>
      ) : hasSearched && mode === 'artists' && artistResults.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="search-outline" size={64} color="#666" />
          <Text style={styles.emptyText}>No artists found</Text>
          <Text style={styles.emptySubtext}>Try a different name</Text>
        </View>
      ) : !hasSearched ? (
        <View style={styles.centerContainer}>
          <Ionicons name="musical-notes-outline" size={64} color="#666" />
          <Text style={styles.emptyText}>
            {mode === 'artists' ? 'Search for artists' : 'Search for albums'}
          </Text>
          <Text style={styles.emptySubtext}>
            {mode === 'artists' ? 'See all albums by an artist' : 'Find albums to log and review'}
          </Text>
        </View>
      ) : mode === 'artists' ? (
        <FlatList
          data={artistResults}
          renderItem={renderArtistResult}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.resultsList}
        />
      ) : (
        <FlatList
          data={results}
          renderItem={renderSearchResult}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.resultsList}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    padding: 16,
    paddingTop: 60,
    backgroundColor: '#000',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    color: '#fff',
    fontSize: 16,
  },
  searchButton: {
    backgroundColor: '#1DB954',
    paddingHorizontal: 20,
    borderRadius: 8,
    justifyContent: 'center',
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  loadingText: {
    color: '#999',
    marginTop: 12,
    fontSize: 14,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
  resultsList: {
    paddingBottom: 20,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  albumCover: {
    width: 60,
    height: 60,
    borderRadius: 4,
  },
  albumPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 4,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultInfo: {
    flex: 1,
    marginLeft: 12,
  },
  albumTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  artist: {
    fontSize: 14,
    color: '#999',
    marginBottom: 2,
  },
  releaseDate: {
    fontSize: 12,
    color: '#666',
  },
  segmentRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  segmentTab: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
  },
  segmentTabActive: {
    backgroundColor: '#1DB954',
  },
  segmentText: {
    fontSize: 14,
    color: '#999',
    fontWeight: '600',
  },
  segmentTextActive: {
    color: '#fff',
  },
  artistImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
});
