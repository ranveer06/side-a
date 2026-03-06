// src/screens/ListDetailScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
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
import { supabase } from '../services/supabase';

export default function ListDetailScreen({ route, navigation }: any) {
  const { listId } = route.params;
  const [list, setList] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    loadList();
  }, [listId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadList();
    });
    return unsubscribe;
  }, [navigation, listId]);

  const loadList = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Load list
      const { data: listData, error: listError } = await supabase
        .from('lists')
        .select('*')
        .eq('id', listId)
        .single();

      if (listError) throw listError;

      // Load profile separately
      const { data: profileData } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', listData.user_id)
        .single();

      const enrichedList = {
        ...listData,
        profiles: profileData,
      };

      setList(enrichedList);
      setIsOwner(user?.id === listData.user_id);

      // Load list items with albums
      const { data: itemsData, error: itemsError } = await supabase
        .from('list_items')
        .select('*')
        .eq('list_id', listId)
        .order('position');

      if (itemsError) throw itemsError;

      // Load albums separately
      if (itemsData && itemsData.length > 0) {
        const albumIds = itemsData.map(item => item.album_id);
        const { data: albumsData } = await supabase
          .from('albums')
          .select('id, title, artist, cover_art_url, release_date')
          .in('id', albumIds);

        const albumsMap = new Map(albumsData?.map(a => [a.id, a]) || []);
        
        const enrichedItems = itemsData.map(item => ({
          ...item,
          albums: albumsMap.get(item.album_id),
        }));

        setItems(enrichedItems);
      } else {
        setItems([]);
      }
    } catch (error) {
      console.error('Error loading list:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadList();
  }, [listId]);

  const handleAddAlbums = () => {
    navigation.navigate('AddToList', {
      listId,
      existingAlbums: items.map(item => item.album_id),
    });
  };

  const handleRemoveItem = (itemId: string, albumTitle: string) => {
    Alert.alert(
      'Remove Album',
      `Remove "${albumTitle}" from this list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('list_items')
                .delete()
                .eq('id', itemId);

              if (error) throw error;
              loadList();
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item, index }: { item: any; index: number }) => (
    <View style={styles.itemContainer}>
      <Text style={styles.position}>{index + 1}</Text>
      <TouchableOpacity
        style={styles.albumCard}
        onPress={() => navigation.navigate('AlbumDetail', { albumId: item.albums.id })}
      >
        {item.albums.cover_art_url ? (
          <Image source={{ uri: item.albums.cover_art_url }} style={styles.cover} />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Ionicons name="disc-outline" size={40} color="#666" />
          </View>
        )}
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {item.albums.title}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>
            {item.albums.artist}
          </Text>
          {item.albums.release_date && (
            <Text style={styles.year}>
              {new Date(item.albums.release_date).getFullYear()}
            </Text>
          )}
          {item.notes && (
            <Text style={styles.notes} numberOfLines={2}>
              {item.notes}
            </Text>
          )}
        </View>
      </TouchableOpacity>
      {isOwner && (
        <TouchableOpacity
          onPress={() => handleRemoveItem(item.id, item.albums.title)}
          style={styles.removeButton}
        >
          <Ionicons name="close-circle" size={24} color="#FF0000" />
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  if (!list) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>List not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {list.title}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.listHeader}>
        <View style={styles.listInfo}>
          <Text style={styles.listTitle}>{list.title}</Text>
          {list.description && (
            <Text style={styles.listDescription}>{list.description}</Text>
          )}
          <View style={styles.listMeta}>
            <Text style={styles.creator}>
              by @{list.profiles?.username || 'unknown'}
            </Text>
            <View style={styles.dot} />
            <Text style={styles.itemCount}>
              {items.length} {items.length === 1 ? 'album' : 'albums'}
            </Text>
            <View style={styles.dot} />
            <Ionicons
              name={list.is_public ? 'globe-outline' : 'lock-closed-outline'}
              size={14}
              color="#999"
            />
            <Text style={styles.visibility}>
              {list.is_public ? 'Public' : 'Private'}
            </Text>
          </View>
        </View>
        {isOwner && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleAddAlbums}
          >
            <Ionicons name="add-circle" size={32} color="#1DB954" />
          </TouchableOpacity>
        )}
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="albums-outline" size={64} color="#666" />
          <Text style={styles.emptyText}>
            {isOwner ? 'No albums yet' : 'This list is empty'}
          </Text>
          {isOwner && (
            <>
              <Text style={styles.emptySubtext}>
                Add albums to start building your list
              </Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={handleAddAlbums}
              >
                <Text style={styles.emptyButtonText}>Add Albums</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  listHeader: {
    flexDirection: 'row',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    alignItems: 'flex-start',
  },
  listInfo: {
    flex: 1,
  },
  listTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  listDescription: {
    fontSize: 15,
    color: '#ddd',
    lineHeight: 22,
    marginBottom: 12,
  },
  listMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  creator: {
    fontSize: 14,
    color: '#1DB954',
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#666',
  },
  itemCount: {
    fontSize: 14,
    color: '#999',
  },
  visibility: {
    fontSize: 14,
    color: '#999',
  },
  addButton: {
    padding: 4,
  },
  list: {
    padding: 16,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  position: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    width: 30,
  },
  albumCard: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 12,
  },
  cover: {
    width: 70,
    height: 70,
    borderRadius: 4,
  },
  coverPlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 4,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
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
  notes: {
    fontSize: 13,
    color: '#ddd',
    fontStyle: 'italic',
    marginTop: 4,
  },
  removeButton: {
    padding: 4,
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
  emptyButton: {
    backgroundColor: '#1DB954',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 18,
    color: '#999',
  },
});
