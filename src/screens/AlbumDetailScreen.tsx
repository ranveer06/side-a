// src/screens/AlbumDetailScreen.tsx - MULTIPLE FORMATS SUPPORT
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase, albumLogService, collectionService } from '../services/supabase';

interface Album {
  id: string;
  musicbrainz_id: string;
  title: string;
  artist: string;
  release_date?: string;
  cover_art_url?: string;
  total_tracks?: number;
}

type Format = 'vinyl' | 'cd' | 'tape' | 'other';

export default function AlbumDetailScreen({ route, navigation }: any) {
  const { albumId } = route.params;
  const [album, setAlbum] = useState<Album | null>(null);
  const [loading, setLoading] = useState(true);
  const [userLog, setUserLog] = useState<any>(null);
  const [collectionFormats, setCollectionFormats] = useState<Format[]>([]);
  const [showFormatModal, setShowFormatModal] = useState(false);

  useEffect(() => {
    loadData();
  }, [albumId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (!loading) {
        checkUserLog();
        checkCollection();
      }
    });
    return unsubscribe;
  }, [navigation, loading]);

  const loadData = async () => {
    await Promise.all([
      loadAlbum(),
      checkUserLog(),
      checkCollection(),
    ]);
  };

  const loadAlbum = async () => {
    try {
      const { data, error } = await supabase
        .from('albums')
        .select('*')
        .eq('id', albumId)
        .single();

      if (error) throw error;
      setAlbum(data);
    } catch (error) {
      console.error('Error loading album:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkUserLog = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('album_logs')
        .select('*')
        .eq('album_id', albumId)
        .eq('user_id', user.id)
        .maybeSingle();

      setUserLog(data);
    } catch (error) {
      console.error('Error checking user log:', error);
    }
  };

  const checkCollection = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get ALL formats of this album in the collection
      const { data, error } = await supabase
        .from('collections')
        .select('format')
        .eq('album_id', albumId)
        .eq('user_id', user.id);

      if (error) throw error;
      
      const formats = (data || []).map(item => item.format as Format);
      setCollectionFormats(formats);
    } catch (error) {
      console.error('Error checking collection:', error);
    }
  };

  const handleLogAlbum = () => {
    navigation.navigate('LogModal', { album, albumId });
  };

  const handleAddToCollection = () => {
    setShowFormatModal(true);
  };

  const handleSelectFormat = async (format: Format) => {
    setShowFormatModal(false);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'Please log in to add to collection');
        return;
      }

      // Check if this specific format already exists
      if (collectionFormats.includes(format)) {
        // Remove this format
        const { error } = await supabase
          .from('collections')
          .delete()
          .eq('album_id', albumId)
          .eq('user_id', user.id)
          .eq('format', format);

        if (error) throw error;
        
        setCollectionFormats(prev => prev.filter(f => f !== format));
        Alert.alert('Success', `Removed ${format.toUpperCase()} from collection`);
      } else {
        // Add this format
        await collectionService.addToCollection({
          user_id: user.id,
          album_id: albumId,
          format,
        });

        setCollectionFormats(prev => [...prev, format]);
        Alert.alert('Success', `Added to collection as ${format.toUpperCase()}`);
      }
    } catch (error: any) {
      console.error('Error toggling collection format:', error);
      Alert.alert('Error', error.message || 'Error updating collection');
    }
  };

  const renderStars = (rating: number) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Ionicons
            key={star}
            name={star <= rating ? 'star' : star - 0.5 <= rating ? 'star-half' : 'star-outline'}
            size={20}
            color="#FFD700"
          />
        ))}
      </View>
    );
  };

  const FormatSelectorModal = () => {
    const isInFormat = (format: Format) => collectionFormats.includes(format);
    
    return (
      <Modal
        visible={showFormatModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFormatModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Manage Collection</Text>
            <Text style={styles.modalSubtitle}>
              {collectionFormats.length > 0 
                ? 'Tap to add/remove formats' 
                : 'Choose format(s) to add'}
            </Text>

            <View style={styles.formatOptions}>
              <TouchableOpacity
                style={[
                  styles.formatOption,
                  isInFormat('vinyl') && styles.formatOptionActive
                ]}
                onPress={() => handleSelectFormat('vinyl')}
              >
                <Ionicons 
                  name={isInFormat('vinyl') ? 'checkmark-circle' : 'disc'} 
                  size={32} 
                  color={isInFormat('vinyl') ? '#1DB954' : '#8B4513'} 
                />
                <Text style={[
                  styles.formatOptionText,
                  isInFormat('vinyl') && styles.formatOptionTextActive
                ]}>
                  Vinyl
                </Text>
                {isInFormat('vinyl') && (
                  <Text style={styles.ownedLabel}>Owned</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.formatOption,
                  isInFormat('cd') && styles.formatOptionActive
                ]}
                onPress={() => handleSelectFormat('cd')}
              >
                <Ionicons 
                  name={isInFormat('cd') ? 'checkmark-circle' : 'disc-outline'} 
                  size={32} 
                  color={isInFormat('cd') ? '#1DB954' : '#C0C0C0'} 
                />
                <Text style={[
                  styles.formatOptionText,
                  isInFormat('cd') && styles.formatOptionTextActive
                ]}>
                  CD
                </Text>
                {isInFormat('cd') && (
                  <Text style={styles.ownedLabel}>Owned</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.formatOption,
                  isInFormat('tape') && styles.formatOptionActive
                ]}
                onPress={() => handleSelectFormat('tape')}
              >
                <Ionicons 
                  name={isInFormat('tape') ? 'checkmark-circle' : 'square'} 
                  size={32} 
                  color={isInFormat('tape') ? '#1DB954' : '#FFD700'} 
                />
                <Text style={[
                  styles.formatOptionText,
                  isInFormat('tape') && styles.formatOptionTextActive
                ]}>
                  Tape
                </Text>
                {isInFormat('tape') && (
                  <Text style={styles.ownedLabel}>Owned</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.formatOption,
                  isInFormat('other') && styles.formatOptionActive
                ]}
                onPress={() => handleSelectFormat('other')}
              >
                <Ionicons 
                  name={isInFormat('other') ? 'checkmark-circle' : 'help-circle-outline'} 
                  size={32} 
                  color={isInFormat('other') ? '#1DB954' : '#999'} 
                />
                <Text style={[
                  styles.formatOptionText,
                  isInFormat('other') && styles.formatOptionTextActive
                ]}>
                  Other
                </Text>
                {isInFormat('other') && (
                  <Text style={styles.ownedLabel}>Owned</Text>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowFormatModal(false)}
            >
              <Text style={styles.cancelButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  if (!album) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#666" />
        <Text style={styles.errorText}>Album not found</Text>
      </View>
    );
  }

  const inCollection = collectionFormats.length > 0;

  return (
    <>
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          {album.cover_art_url ? (
            <Image source={{ uri: album.cover_art_url }} style={styles.coverArt} />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Ionicons name="disc-outline" size={100} color="#666" />
            </View>
          )}

          <Text style={styles.title}>{album.title}</Text>
          <Text style={styles.artist}>{album.artist}</Text>

          <View style={styles.metadata}>
            {album.release_date && (
              <View style={styles.metaItem}>
                <Ionicons name="calendar-outline" size={16} color="#999" />
                <Text style={styles.metaText}>
                  {new Date(album.release_date).getFullYear()}
                </Text>
              </View>
            )}
            {album.total_tracks && (
              <View style={styles.metaItem}>
                <Ionicons name="musical-notes-outline" size={16} color="#999" />
                <Text style={styles.metaText}>{album.total_tracks} tracks</Text>
              </View>
            )}
          </View>

          {/* Show owned formats */}
          {collectionFormats.length > 0 && (
            <View style={styles.ownedFormatsContainer}>
              <Text style={styles.ownedFormatsLabel}>In your collection:</Text>
              <View style={styles.ownedFormatsBadges}>
                {collectionFormats.map(format => (
                  <View key={format} style={styles.formatBadge}>
                    <Text style={styles.formatBadgeText}>{format.toUpperCase()}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {userLog && (
          <View style={styles.userLogSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Your Review</Text>
              {userLog.is_favorite && (
                <Ionicons name="heart" size={20} color="#FF0000" />
              )}
            </View>
            <View style={styles.userLogCard}>
              {renderStars(userLog.rating || 0)}
              {userLog.review_text && (
                <Text style={styles.reviewText}>{userLog.review_text}</Text>
              )}
              <Text style={styles.logDate}>
                Logged on {new Date(userLog.listened_date).toLocaleDateString()}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.actions}>
          <TouchableOpacity 
            style={styles.primaryButton} 
            onPress={handleLogAlbum}
            activeOpacity={0.8}
          >
            <Ionicons name="create-outline" size={22} color="#fff" />
            <Text style={styles.primaryButtonText}>
              {userLog ? 'Update Log' : 'Log This Album'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, inCollection && styles.secondaryButtonActive]}
            onPress={handleAddToCollection}
            activeOpacity={0.8}
          >
            <Ionicons
              name={inCollection ? 'albums' : 'albums-outline'}
              size={22}
              color={inCollection ? '#1DB954' : '#fff'}
            />
            <Text style={[styles.secondaryButtonText, inCollection && styles.secondaryButtonTextActive]}>
              {inCollection ? `In Collection (${collectionFormats.length})` : 'Add to Collection'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.reviewsSection}>
          <Text style={styles.sectionTitle}>Community Reviews</Text>
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={48} color="#666" />
            <Text style={styles.emptyText}>No reviews yet</Text>
            <Text style={styles.emptySubtext}>Be the first to log this album!</Text>
          </View>
        </View>
      </ScrollView>

      <FormatSelectorModal />
    </>
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
    alignItems: 'center',
    padding: 24,
    paddingTop: 20,
  },
  coverArt: {
    width: 250,
    height: 250,
    borderRadius: 8,
    marginBottom: 24,
  },
  coverPlaceholder: {
    width: 250,
    height: 250,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  artist: {
    fontSize: 18,
    color: '#999',
    textAlign: 'center',
    marginBottom: 16,
  },
  metadata: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 14,
    color: '#999',
  },
  ownedFormatsContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  ownedFormatsLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  ownedFormatsBadges: {
    flexDirection: 'row',
    gap: 8,
  },
  formatBadge: {
    backgroundColor: '#1DB954',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  formatBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  userLogSection: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#222',
    backgroundColor: '#0a0a0a',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  userLogCard: {
    backgroundColor: '#111',
    padding: 16,
    borderRadius: 8,
  },
  starsContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  reviewText: {
    fontSize: 15,
    color: '#ddd',
    lineHeight: 22,
    marginBottom: 12,
  },
  logDate: {
    fontSize: 12,
    color: '#666',
  },
  actions: {
    padding: 16,
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1DB954',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  secondaryButtonActive: {
    borderColor: '#1DB954',
    backgroundColor: '#0a1a0a',
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  secondaryButtonTextActive: {
    color: '#1DB954',
  },
  reviewsSection: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#222',
    marginTop: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#555',
    marginTop: 4,
  },
  errorText: {
    fontSize: 18,
    color: '#999',
    marginTop: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#111',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginBottom: 24,
  },
  formatOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  formatOption: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    minWidth: 70,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  formatOptionActive: {
    borderColor: '#1DB954',
    backgroundColor: '#0a2a0a',
  },
  formatOptionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  formatOptionTextActive: {
    color: '#1DB954',
  },
  ownedLabel: {
    fontSize: 10,
    color: '#1DB954',
    marginTop: 4,
    fontWeight: '600',
  },
  cancelButton: {
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#999',
    fontSize: 16,
    fontWeight: '600',
  },
});
