// src/screens/CollectionScreen.tsx - IMPROVED
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase, collectionService } from '../services/supabase';

type Format = 'all' | 'vinyl' | 'cd' | 'tape';

interface CollectionItem {
  id: string;
  format: string;
  condition?: string;
  purchase_date?: string;
  albums: {
    id: string;
    title: string;
    artist: string;
    cover_art_url?: string;
  };
}

export default function CollectionScreen({ navigation }: any) {
  const [selectedFormat, setSelectedFormat] = useState<Format>('all');
  const [collection, setCollection] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadCollection();
  }, [selectedFormat]);

  const loadCollection = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const format = selectedFormat === 'all' ? undefined : selectedFormat;
      const data = await collectionService.getUserCollection(user.id, format);
      setCollection(data || []);
    } catch (error) {
      console.error('Error loading collection:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadCollection();
  }, [selectedFormat]);

  const handleRemoveFromCollection = async (collectionId: string, albumTitle: string) => {
    Alert.alert(
      'Remove from Collection',
      `Remove "${albumTitle}" from your collection?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await collectionService.removeFromCollection(collectionId);
              setCollection(prev => prev.filter(item => item.id !== collectionId));
              Alert.alert('Success', 'Removed from collection');
            } catch (error: any) {
              console.error('Error removing from collection:', error);
              Alert.alert('Error', error.message || 'Failed to remove from collection');
            }
          },
        },
      ]
    );
  };

  const getFormatIcon = (format: string) => {
    switch (format) {
      case 'vinyl':
        return 'disc';
      case 'cd':
        return 'disc-outline';
      case 'tape':
        return 'square';
      default:
        return 'albums';
    }
  };

  const getFormatColor = (format: string) => {
    switch (format) {
      case 'vinyl':
        return '#8B4513';
      case 'cd':
        return '#C0C0C0';
      case 'tape':
        return '#FFD700';
      default:
        return '#666';
    }
  };

  const renderItem = ({ item }: { item: CollectionItem }) => (
    <TouchableOpacity
      style={styles.item}
      onPress={() => navigation.navigate('AlbumDetail', { albumId: item.albums.id })}
      onLongPress={() => handleRemoveFromCollection(item.id, item.albums.title)}
    >
      <View style={styles.itemContent}>
        {item.albums.cover_art_url ? (
          <Image source={{ uri: item.albums.cover_art_url }} style={styles.cover} />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Ionicons name="disc-outline" size={40} color="#666" />
          </View>
        )}

        <View style={styles.itemInfo}>
          <Text style={styles.itemTitle} numberOfLines={1}>
            {item.albums.title}
          </Text>
          <Text style={styles.itemArtist} numberOfLines={1}>
            {item.albums.artist}
          </Text>
          
          <View style={styles.itemMeta}>
            <View style={styles.formatBadge}>
              <Ionicons
                name={getFormatIcon(item.format)}
                size={14}
                color={getFormatColor(item.format)}
              />
              <Text style={[styles.formatText, { color: getFormatColor(item.format) }]}>
                {item.format.toUpperCase()}
              </Text>
            </View>
            {item.condition && (
              <Text style={styles.conditionText}>
                {item.condition.replace('_', ' ')}
              </Text>
            )}
          </View>
        </View>

        <Ionicons name="chevron-forward" size={20} color="#666" />
      </View>
    </TouchableOpacity>
  );

  const renderFormatTab = (format: Format, label: string, icon: string, count: number) => {
    const isSelected = selectedFormat === format;
    return (
      <TouchableOpacity
        key={format}
        style={[styles.tab, isSelected && styles.tabActive]}
        onPress={() => setSelectedFormat(format)}
      >
        <Ionicons
          name={icon as any}
          size={20}
          color={isSelected ? '#1DB954' : '#666'}
        />
        <Text style={[styles.tabText, isSelected && styles.tabTextActive]}>
          {label}
        </Text>
        <View style={[styles.countBadge, isSelected && styles.countBadgeActive]}>
          <Text style={[styles.countText, isSelected && styles.countTextActive]}>
            {count}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const getStats = () => {
    // Get all items (not just filtered)
    const [allItems, setAllItems] = useState<CollectionItem[]>([]);
    
    useEffect(() => {
      const loadAllItems = async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          const data = await collectionService.getUserCollection(user.id);
          setAllItems(data || []);
        } catch (error) {
          console.error('Error loading all items:', error);
        }
      };
      loadAllItems();
    }, []);

    const total = allItems.length;
    const vinyl = allItems.filter(item => item.format === 'vinyl').length;
    const cd = allItems.filter(item => item.format === 'cd').length;
    const tape = allItems.filter(item => item.format === 'tape').length;
    
    return { total, vinyl, cd, tape };
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  // Get counts from current collection data
  const total = collection.length;
  const vinylCount = collection.filter(item => item.format === 'vinyl').length;
  const cdCount = collection.filter(item => item.format === 'cd').length;
  const tapeCount = collection.filter(item => item.format === 'tape').length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Collection</Text>
        <View style={styles.headerStats}>
          <View style={styles.headerStatItem}>
            <Ionicons name="disc" size={16} color="#8B4513" />
            <Text style={styles.headerStatText}>{vinylCount} Vinyl</Text>
          </View>
          <View style={styles.headerStatItem}>
            <Ionicons name="disc-outline" size={16} color="#C0C0C0" />
            <Text style={styles.headerStatText}>{cdCount} CD</Text>
          </View>
          <View style={styles.headerStatItem}>
            <Ionicons name="square" size={16} color="#FFD700" />
            <Text style={styles.headerStatText}>{tapeCount} Tape</Text>
          </View>
        </View>
      </View>

      <View style={styles.tabs}>
        {renderFormatTab('all', 'All', 'albums', total)}
        {renderFormatTab('vinyl', 'Vinyl', 'disc', vinylCount)}
        {renderFormatTab('cd', 'CD', 'disc-outline', cdCount)}
        {renderFormatTab('tape', 'Tape', 'square', tapeCount)}
      </View>

      {collection.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="albums-outline" size={80} color="#666" />
          <Text style={styles.emptyText}>
            {selectedFormat === 'all' 
              ? 'No albums in collection' 
              : `No ${selectedFormat} in collection`}
          </Text>
          <Text style={styles.emptySubtext}>
            Add albums from the album detail page
          </Text>
          <TouchableOpacity
            style={styles.searchButton}
            onPress={() => navigation.navigate('Search')}
          >
            <Ionicons name="search" size={20} color="#fff" />
            <Text style={styles.searchButtonText}>Search Albums</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={collection}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          />
          <Text style={styles.hint}>Long press to remove from collection</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginBottom: 12,
  },
  headerStats: {
    flexDirection: 'row',
    gap: 16,
  },
  headerStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerStatText: {
    fontSize: 14,
    color: '#999',
    fontWeight: '500',
  },
  tabs: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    backgroundColor: '#000',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  tab: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
  },
  tabActive: {
    backgroundColor: '#0a2a0a',
    borderWidth: 1,
    borderColor: '#1DB954',
  },
  tabText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#1DB954',
  },
  countBadge: {
    backgroundColor: '#222',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    alignItems: 'center',
  },
  countBadgeActive: {
    backgroundColor: '#1DB954',
  },
  countText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
  },
  countTextActive: {
    color: '#fff',
  },
  list: {
    paddingBottom: 20,
  },
  item: {
    backgroundColor: '#111',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  cover: {
    width: 80,
    height: 80,
    borderRadius: 4,
  },
  coverPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 4,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  itemArtist: {
    fontSize: 14,
    color: '#999',
    marginBottom: 8,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  formatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  formatText: {
    fontSize: 12,
    fontWeight: '600',
  },
  conditionText: {
    fontSize: 12,
    color: '#666',
    textTransform: 'capitalize',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
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
    marginBottom: 24,
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1DB954',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  hint: {
    textAlign: 'center',
    color: '#666',
    fontSize: 12,
    paddingVertical: 12,
  },
});
