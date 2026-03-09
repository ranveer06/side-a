// src/screens/AddToListScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spotifyService } from '../services/spotify';
import { supabase } from '../services/supabase';

export default function AddToListScreen({ route, navigation }: any) {
  const { listId, existingAlbums = [] } = route.params;
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setHasSearched(true);

    try {
      const searchResults = await spotifyService.searchAlbums(searchQuery, 20);
      setResults(searchResults);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAlbum = async (result: any) => {
    setAdding(result.id);

    try {
      // Cache album in Supabase first
      const album = await spotifyService.getOrCacheAlbum(result.id);
      
      if (!album) throw new Error('Failed to load album');

      // Check if already in list
      if (existingAlbums.includes(album.id)) {
        Alert.alert('Already Added', 'This album is already in the list');
        setAdding(null);
        return;
      }

      // Get current max position
      const { data: items } = await supabase
        .from('list_items')
        .select('position')
        .eq('list_id', listId)
        .order('position', { ascending: false })
        .limit(1);

      const nextPosition = items && items.length > 0 ? items[0].position + 1 : 1;

      // Add to list
      const { error } = await supabase
        .from('list_items')
        .insert({
          list_id: listId,
          album_id: album.id,
          position: nextPosition,
        });

      if (error) throw error;

      Alert.alert('Success', 'Album added to list!');
      
      // Add to existing albums to prevent re-adding
      existingAlbums.push(album.id);
    } catch (error: any) {
      console.error('Error adding to list:', error);
      Alert.alert('Error', error.message || 'Failed to add album');
    } finally {
      setAdding(null);
    }
  };

  const renderAlbum = ({ item }: { item: any }) => {
    const isAdding = adding === item.id;
    const alreadyAdded = existingAlbums.includes(item.id);

    return (
      <View style={styles.albumItem}>
        {item.coverArtUrl ? (
          <Image source={{ uri: item.coverArtUrl }} style={styles.coverImage} />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Ionicons name="disc-outline" size={40} color="#666" />
          </View>
        )}
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
        {alreadyAdded ? (
          <View style={styles.addedBadge}>
            <Ionicons name="checkmark-circle" size={24} color="#1DB954" />
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => handleAddAlbum(item)}
            disabled={isAdding}
            style={styles.addButton}
          >
            {isAdding ? (
              <ActivityIndicator size="small" color="#1DB954" />
            ) : (
              <Ionicons name="add-circle" size={32} color="#1DB954" />
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Albums</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for albums..."
            placeholderTextColor="#666"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            autoCapitalize="none"
            autoFocus
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
          <Text style={styles.emptyText}>No albums found</Text>
        </View>
      ) : !hasSearched ? (
        <View style={styles.centerContainer}>
          <Ionicons name="musical-notes-outline" size={64} color="#666" />
          <Text style={styles.emptyText}>Search for albums to add</Text>
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
    padding: 16,
  },
  albumItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#111',
    borderRadius: 8,
    marginBottom: 8,
  },
  coverImage: {
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
  addButton: {
    padding: 4,
  },
  addedBadge: {
    padding: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
});
