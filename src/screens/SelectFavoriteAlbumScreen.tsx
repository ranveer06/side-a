// src/screens/SelectFavoriteAlbumScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { musicBrainzService } from '../services/musicbrainz';

export default function SelectFavoriteAlbumScreen({ route, navigation }: any) {
  const { position, usedArtists = [], onSelect } = route.params;
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setHasSearched(true);

    try {
      const searchResults = await musicBrainzService.searchAlbums(searchQuery, 20);
      
      // Filter out artists already in favorites
      const filtered = searchResults.filter(
        album => !usedArtists.includes(album.artist.toLowerCase())
      );
      
      setResults(filtered);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAlbum = async (result: any) => {
    // Cache album in Supabase first
    const album = await musicBrainzService.getOrCacheAlbum(result.id);
    
    if (album) {
      onSelect({
        id: album.id,
        title: album.title,
        artist: album.artist,
        cover_art_url: album.cover_art_url,
      });
      navigation.goBack();
    }
  };

  const renderAlbum = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.albumItem}
      onPress={() => handleSelectAlbum(item)}
    >
      <View style={styles.coverPlaceholder}>
        <Ionicons name="disc-outline" size={40} color="#666" />
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {item.artist}
        </Text>
        {item.date && (
          <Text style={styles.year}>{new Date(item.date).getFullYear()}</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color="#666" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Favorite #{position}</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search any album..."
            placeholderTextColor="#666"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            autoCapitalize="none"
          />
        </View>
        <TouchableOpacity
          style={styles.searchButton}
          onPress={handleSearch}
          disabled={!searchQuery.trim()}
        >
          <Text style={styles.searchButtonText}>Search</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#1DB954" />
        </View>
      ) : hasSearched && results.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={64} color="#666" />
          <Text style={styles.emptyText}>
            {usedArtists.length > 0 
              ? 'No albums found (excluding artists already in favorites)'
              : 'No albums found'}
          </Text>
        </View>
      ) : !hasSearched ? (
        <View style={styles.centerContainer}>
          <Ionicons name="musical-notes-outline" size={64} color="#666" />
          <Text style={styles.emptyText}>Search for any album</Text>
          <Text style={styles.emptySubtext}>
            One album per artist rule applies
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
          renderItem={renderAlbum}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerTitle: {
    fontSize: 18,
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
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    marginLeft: 8,
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
  list: {
    paddingBottom: 20,
  },
  albumItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  cover: {
    width: 60,
    height: 60,
    borderRadius: 4,
  },
  coverPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 4,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
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
  year: {
    fontSize: 12,
    color: '#666',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#555',
    marginTop: 8,
    textAlign: 'center',
  },
});
