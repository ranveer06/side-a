// src/screens/ManageFavoritesScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { supabase, albumLogService } from '../services/supabase';
import RemoteImage from '../components/RemoteImage';
import AlbumCover from '../components/AlbumCover';

interface Favorite {
  position: number;
  album: {
    id: string;
    title: string;
    artist: string;
    cover_art_url?: string;
    musicbrainz_id?: string | null;
  } | null;
}

export default function ManageFavoritesScreen({ navigation }: any) {
  const [favorites, setFavorites] = useState<Favorite[]>([
    { position: 1, album: null },
    { position: 2, album: null },
    { position: 3, album: null },
    { position: 4, album: null },
    { position: 5, album: null },
  ]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profile_favorites')
        .select(`
          position,
          albums (
            id,
            title,
            artist,
            cover_art_url,
            musicbrainz_id
          )
        `)
        .eq('user_id', user.id)
        .order('position');

      if (error) throw error;

      if (data && data.length > 0) {
        const loadedFavorites = [...favorites];
        data.forEach((fav: any) => {
          if (fav.position >= 1 && fav.position <= 5) {
            loadedFavorites[fav.position - 1] = {
              position: fav.position,
              album: fav.albums,
            };
          }
        });
        setFavorites(loadedFavorites);
      }
    } catch (error) {
      console.error('Error loading favorites:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAlbum = async (position: number) => {
    try {
      // Get artists already in favorites (excluding this position)
      const usedArtists = favorites
        .filter(f => f.position !== position && f.album)
        .map(f => f.album!.artist.toLowerCase());

      // Navigate to album search/selector
      navigation.navigate('SelectFavoriteAlbum', {
        position,
        usedArtists,
        onSelect: (album: any) => {
          const newFavorites = [...favorites];
          newFavorites[position - 1] = { position, album };
          setFavorites(newFavorites);
        },
      });
    } catch (error) {
      console.error('Error selecting album:', error);
    }
  };

  const handleRemove = (position: number) => {
    const newFavorites = [...favorites];
    newFavorites[position - 1] = { position, album: null };
    setFavorites(newFavorites);
  };

  const handleSave = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setSaving(true);

      // Delete all existing favorites
      await supabase
        .from('profile_favorites')
        .delete()
        .eq('user_id', user.id);

      // Insert new favorites
      const favoritesToSave = favorites
        .filter(f => f.album !== null)
        .map(f => ({
          user_id: user.id,
          album_id: f.album!.id,
          position: f.position,
        }));

      if (favoritesToSave.length > 0) {
        const { error } = await supabase
          .from('profile_favorites')
          .insert(favoritesToSave);

        if (error) throw error;
      }

      Alert.alert('Success', 'Favorites saved!', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error: any) {
      console.error('Error saving favorites:', error);
      Alert.alert('Error', error.message || 'Failed to save favorites');
    } finally {
      setSaving(false);
    }
  };

  const renderFavorite = ({ item }: { item: Favorite }) => (
    <View style={styles.favoriteSlot}>
      <View style={styles.slotHeader}>
        <Text style={styles.slotNumber}>#{item.position}</Text>
        {item.album && (
          <TouchableOpacity
            onPress={() => handleRemove(item.position)}
            style={styles.removeButton}
          >
            <Ionicons name="close-circle" size={24} color="#FF0000" />
          </TouchableOpacity>
        )}
      </View>

      {item.album ? (
        <TouchableOpacity
          style={styles.albumCard}
          onPress={() => handleSelectAlbum(item.position)}
        >
          <AlbumCover
            coverArtUrl={item.album.cover_art_url}
            albumId={item.album.id}
            title={item.album.title}
            artist={item.album.artist}
            style={styles.albumCover}
          />
          <View style={styles.albumInfo}>
            <Text style={styles.albumTitle} numberOfLines={2}>
              {item.album.title}
            </Text>
            <Text style={styles.albumArtist} numberOfLines={1}>
              {item.album.artist}
            </Text>
          </View>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.emptySlot}
          onPress={() => handleSelectAlbum(item.position)}
        >
          <Ionicons name="add-circle-outline" size={48} color="#666" />
          <Text style={styles.emptyText}>Tap to add favorite</Text>
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Five Favorites</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color="#1DB954" />
          ) : (
            <Text style={styles.saveText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          Choose your 5 favorite albums. Only one album per artist allowed!
        </Text>
      </View>

      <FlatList
        data={favorites}
        renderItem={renderFavorite}
        keyExtractor={(item) => item.position.toString()}
        contentContainerStyle={styles.list}
      />
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
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1DB954',
  },
  infoBox: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    margin: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#1DB954',
  },
  infoText: {
    color: '#ddd',
    fontSize: 14,
    lineHeight: 20,
  },
  list: {
    padding: 16,
    paddingTop: 0,
  },
  favoriteSlot: {
    marginBottom: 20,
  },
  slotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  slotNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1DB954',
  },
  removeButton: {
    padding: 4,
  },
  albumCard: {
    flexDirection: 'row',
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  albumCover: {
    width: 80,
    height: 80,
    borderRadius: 4,
  },
  albumCoverPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 4,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  albumInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  albumTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  albumArtist: {
    fontSize: 14,
    color: '#999',
  },
  emptySlot: {
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 40,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#333',
    borderStyle: 'dashed',
  },
  emptyText: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
  },
});
