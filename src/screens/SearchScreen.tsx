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
import { musicBrainzService, type SearchResult } from '../services/musicbrainz';

interface EnrichedSearchResult extends SearchResult {
  coverArtUrl?: string;
  loading?: boolean;
}

export default function SearchScreen({ navigation }: any) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<EnrichedSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const fetchCoverArt = async (mbid: string): Promise<string | undefined> => {
    try {
      const response = await fetch(`https://coverartarchive.org/release-group/${mbid}`);
      if (response.ok) {
        const data = await response.json();
        const frontCover = data.images?.find((img: any) => img.front === true);
        return frontCover?.thumbnails?.small || data.images?.[0]?.thumbnails?.small;
      }
    } catch (error) {
      return undefined;
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) return;

    Keyboard.dismiss();
    setLoading(true);
    setHasSearched(true);

    try {
      const searchResults = await musicBrainzService.searchAlbums(query, 20);
      
      const enrichedResults: EnrichedSearchResult[] = searchResults.map(r => ({
        ...r,
        loading: true,
      }));
      setResults(enrichedResults);

      const coverArtPromises = searchResults.map(async (result, index) => {
        const coverUrl = await fetchCoverArt(result.id);
        return { index, coverUrl };
      });

      Promise.all(coverArtPromises).then(covers => {
        setResults(prev => {
          const updated = [...prev];
          covers.forEach(({ index, coverUrl }) => {
            if (updated[index]) {
              updated[index] = {
                ...updated[index],
                coverArtUrl: coverUrl,
                loading: false,
              };
            }
          });
          return updated;
        });
      });
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAlbumPress = async (result: EnrichedSearchResult) => {
    const album = await musicBrainzService.getOrCacheAlbum(result.id);
    
    if (album) {
      navigation.navigate('AlbumDetail', { albumId: album.id });
    }
  };

  const renderSearchResult = ({ item }: { item: EnrichedSearchResult }) => (
    <TouchableOpacity
      style={styles.resultItem}
      onPress={() => handleAlbumPress(item)}
    >
      {item.coverArtUrl ? (
        <Image 
          source={{ uri: item.coverArtUrl }} 
          style={styles.albumCover}
        />
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
            placeholder="Search for albums..."
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

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#1DB954" />
          <Text style={styles.loadingText}>Searching albums...</Text>
        </View>
      ) : hasSearched && results.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="search-outline" size={64} color="#666" />
          <Text style={styles.emptyText}>No results found</Text>
          <Text style={styles.emptySubtext}>
            Try searching with different keywords
          </Text>
        </View>
      ) : !hasSearched ? (
        <View style={styles.centerContainer}>
          <Ionicons name="musical-notes-outline" size={64} color="#666" />
          <Text style={styles.emptyText}>Search for albums</Text>
          <Text style={styles.emptySubtext}>
            Find albums to log and review
          </Text>
        </View>
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
});
