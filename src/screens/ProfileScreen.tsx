// src/screens/ProfileScreen.tsx - WITH FIVE FAVORITES
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase, albumLogService, profileService, authService } from '../services/supabase';

export default function ProfileScreen({ route, navigation }: any) {
  // Check if viewing another user's profile
  const viewingUserId = route?.params?.userId;
  const isOwnProfile = !viewingUserId;

  const [profile, setProfile] = useState<any>(null);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [collection, setCollection] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalLogs: 0,
    avgRating: 0,
    favorites: 0,
    collectionCount: 0,
    followingCount: 0,
    followersCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [viewingUserId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (!loading) {
        loadProfile();
      }
    });
    return unsubscribe;
  }, [navigation, loading, viewingUserId]);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const profileUserId = viewingUserId || user?.id;
      
      if (!profileUserId) {
        setLoading(false);
        return;
      }

      const profileData = await profileService.getProfile(profileUserId);
      setProfile(profileData);

      // Load Five Favorites
      const { data: favoritesData } = await supabase
        .from('profile_favorites')
        .select(`
          position,
          albums (
            id,
            title,
            artist,
            cover_art_url
          )
        `)
        .eq('user_id', profileUserId)
        .order('position');
      
      setFavorites(favoritesData || []);

      const logsData = await albumLogService.getUserLogs(profileUserId);
      setLogs(logsData || []);

      const totalLogs = logsData?.length || 0;
      const favoriteCount = logsData?.filter(log => log.is_favorite).length || 0;
      
      let avgRating = 0;
      if (logsData && logsData.length > 0) {
        const sum = logsData.reduce((acc, log) => acc + (log.rating || 0), 0);
        avgRating = sum / logsData.length;
      }

      const { count: collectionCount } = await supabase
        .from('collections')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profileUserId);

      // Get following count
      const { count: followingCount } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', profileUserId);

      // Get followers count
      const { count: followersCount } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', profileUserId);

      // Load collection items for preview (up to 6)
      const { data: collectionData } = await supabase
        .from('collections')
        .select('*, albums(*)')
        .eq('user_id', profileUserId)
        .order('created_at', { ascending: false })
        .limit(6);

      setCollection(collectionData || []);

      setStats({
        totalLogs,
        avgRating,
        favorites: favoriteCount,
        collectionCount: collectionCount || 0,
        followingCount: followingCount || 0,
        followersCount: followersCount || 0,
      });
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadProfile();
  }, [viewingUserId]);

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await authService.signOut();
          },
        },
      ]
    );
  };

  const handleEditProfile = () => {
    navigation.navigate('EditProfile');
  };

  const handleManageFavorites = () => {
    navigation.navigate('ManageFavorites');
  };

  const handleFindUsers = () => {
    navigation.navigate('FindUsers');
  };

  const renderStars = (rating: number) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Ionicons
            key={star}
            name={star <= rating ? 'star' : star - 0.5 <= rating ? 'star-half' : 'star-outline'}
            size={14}
            color="#FFD700"
          />
        ))}
      </View>
    );
  };

  const renderFavoriteAlbum = (favorite: any, index: number) => (
    <TouchableOpacity
      key={index}
      style={styles.favoriteItem}
      onPress={() => {
        if (favorite.albums) {
          navigation.navigate('AlbumDetail', { albumId: favorite.albums.id });
        }
      }}
    >
      <View style={styles.favoriteNumber}>
        <Text style={styles.favoriteNumberText}>{favorite.position}</Text>
      </View>
      {favorite.albums?.cover_art_url ? (
        <Image
          source={{ uri: favorite.albums.cover_art_url }}
          style={styles.favoriteCover}
        />
      ) : (
        <View style={styles.favoriteCoverPlaceholder}>
          <Ionicons name="disc-outline" size={30} color="#666" />
        </View>
      )}
      <View style={styles.favoriteInfo}>
        <Text style={styles.favoriteTitle} numberOfLines={1}>
          {favorite.albums?.title || 'Unknown'}
        </Text>
        <Text style={styles.favoriteArtist} numberOfLines={1}>
          {favorite.albums?.artist || 'Unknown'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderLogItem = (log: any) => (
    <TouchableOpacity
      key={log.id}
      style={styles.logItem}
      onPress={() => navigation.navigate('AlbumDetail', { albumId: log.album_id })}
    >
      {log.albums?.cover_art_url ? (
        <Image source={{ uri: log.albums.cover_art_url }} style={styles.logCover} />
      ) : (
        <View style={styles.logCoverPlaceholder}>
          <Ionicons name="disc-outline" size={24} color="#666" />
        </View>
      )}
      <View style={styles.logInfo}>
        <Text style={styles.logTitle} numberOfLines={1}>
          {log.albums?.title || 'Unknown Album'}
        </Text>
        <Text style={styles.logArtist} numberOfLines={1}>
          {log.albums?.artist || 'Unknown Artist'}
        </Text>
        {renderStars(log.rating || 0)}
      </View>
      {log.is_favorite && (
        <Ionicons name="heart" size={16} color="#FF0000" />
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Profile</Text>
          {isOwnProfile && (
            <TouchableOpacity onPress={handleSignOut}>
              <Ionicons name="log-out-outline" size={24} color="#999" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Profile Info */}
      <View style={styles.profileSection}>
        <View style={styles.avatarContainer}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={50} color="#666" />
            </View>
          )}
        </View>
        
        <Text style={styles.username}>
          @{profile?.username || 'username'}
        </Text>
        
        {profile?.display_name && (
          <Text style={styles.displayName}>{profile.display_name}</Text>
        )}
        
        {profile?.bio && (
          <Text style={styles.bio}>{profile.bio}</Text>
        )}

        {/* Action Buttons - Only show if viewing own profile */}
        {isOwnProfile && (
          <>
            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={styles.editButton}
                onPress={handleEditProfile}
              >
                <Ionicons name="create-outline" size={18} color="#fff" />
                <Text style={styles.editButtonText}>Edit Profile</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.listsButton}
                onPress={() => navigation.navigate('MyLists')}
              >
                <Ionicons name="list-outline" size={18} color="#1DB954" />
                <Text style={styles.listsButtonText}>My Lists</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.followStatsRow}>
              <TouchableOpacity 
                style={styles.followStat}
                onPress={() => navigation.navigate('Following')}
              >
                <Text style={styles.followStatValue}>{stats.followingCount}</Text>
                <Text style={styles.followStatLabel}>Following</Text>
              </TouchableOpacity>
              
              <View style={styles.followStatDivider} />
              
              <TouchableOpacity 
                style={styles.followStat}
                onPress={() => navigation.navigate('Following')}
              >
                <Text style={styles.followStatValue}>{stats.followersCount}</Text>
                <Text style={styles.followStatLabel}>Followers</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* Stats */}
      <View style={styles.statsSection}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.totalLogs}</Text>
          <Text style={styles.statLabel}>Logs</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.avgRating.toFixed(1)}</Text>
          <Text style={styles.statLabel}>Avg Rating</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.favorites}</Text>
          <Text style={styles.statLabel}>Favorites</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.collectionCount}</Text>
          <Text style={styles.statLabel}>Collection</Text>
        </View>
      </View>

      {/* Five Favorites */}
      <View style={styles.favoritesSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Five Favorites</Text>
          {isOwnProfile && (
            <TouchableOpacity onPress={handleManageFavorites}>
              <Text style={styles.manageText}>Manage</Text>
            </TouchableOpacity>
          )}
        </View>

        {favorites.length > 0 ? (
          <View style={styles.favoritesList}>
            {favorites.map((fav, index) => renderFavoriteAlbum(fav, index))}
          </View>
        ) : (
          <View style={styles.emptyFavorites}>
            <Ionicons name="star-outline" size={48} color="#666" />
            <Text style={styles.emptyText}>
              {isOwnProfile ? 'No favorites yet' : 'No favorites set'}
            </Text>
            {isOwnProfile && (
              <TouchableOpacity
                style={styles.addFavoritesButton}
                onPress={handleManageFavorites}
              >
                <Text style={styles.addFavoritesButtonText}>Add Favorites</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Collection Preview */}
      {stats.collectionCount > 0 && (
        <View style={styles.collectionSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Collection</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Collection')}>
              <Text style={styles.viewAllText}>View All ({stats.collectionCount})</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.collectionGrid}>
            {collection.map((item, index) => (
              <TouchableOpacity
                key={item.id}
                style={styles.collectionItem}
                onPress={() => navigation.navigate('AlbumDetail', { albumId: item.album_id })}
              >
                {item.albums?.cover_art_url ? (
                  <Image
                    source={{ uri: item.albums.cover_art_url }}
                    style={styles.collectionCover}
                  />
                ) : (
                  <View style={styles.collectionCoverPlaceholder}>
                    <Ionicons name="disc-outline" size={30} color="#666" />
                  </View>
                )}
                <View style={styles.formatIndicator}>
                  <Ionicons
                    name={
                      item.format === 'vinyl' ? 'disc' :
                      item.format === 'cd' ? 'disc-outline' :
                      item.format === 'tape' ? 'square' :
                      'help-circle-outline'
                    }
                    size={12}
                    color={
                      item.format === 'vinyl' ? '#8B4513' :
                      item.format === 'cd' ? '#C0C0C0' :
                      item.format === 'tape' ? '#FFD700' :
                      '#999'
                    }
                  />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Recent Logs */}
      <View style={styles.logsSection}>
        <Text style={styles.sectionTitle}>Recent Logs</Text>
        {logs.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="musical-notes-outline" size={48} color="#666" />
            <Text style={styles.emptyText}>No logs yet</Text>
            {isOwnProfile && (
              <TouchableOpacity
                style={styles.startButton}
                onPress={() => navigation.navigate('Search')}
              >
                <Text style={styles.startButtonText}>Start Logging</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <>
            {logs.slice(0, 10).map(renderLogItem)}
            {logs.length > 10 && (
              <Text style={styles.moreText}>
                + {logs.length - 10} more logs
              </Text>
            )}
          </>
        )}
      </View>
    </ScrollView>
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
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  profileSection: {
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  username: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  displayName: {
    fontSize: 16,
    color: '#999',
    marginBottom: 8,
  },
  bio: {
    fontSize: 14,
    color: '#ddd',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  findUsersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1DB954',
  },
  findUsersText: {
    color: '#1DB954',
    fontSize: 14,
    fontWeight: '600',
  },
  listsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1DB954',
  },
  listsButtonText: {
    color: '#1DB954',
    fontSize: 14,
    fontWeight: '600',
  },
  findUsersButtonFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1DB954',
    backgroundColor: '#0a1a0a',
  },
  findUsersTextFull: {
    color: '#1DB954',
    fontSize: 15,
    fontWeight: '600',
  },
  followStatsRow: {
    flexDirection: 'row',
    marginTop: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    gap: 16,
  },
  followStat: {
    flex: 1,
    alignItems: 'center',
  },
  followStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1DB954',
    marginBottom: 4,
  },
  followStatLabel: {
    fontSize: 13,
    color: '#999',
  },
  followStatDivider: {
    width: 1,
    backgroundColor: '#333',
  },
  statsSection: {
    flexDirection: 'row',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1DB954',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#222',
  },
  favoritesSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  manageText: {
    fontSize: 16,
    color: '#1DB954',
    fontWeight: '600',
  },
  favoritesList: {
    gap: 12,
  },
  favoriteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 12,
    gap: 12,
  },
  favoriteNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1DB954',
    justifyContent: 'center',
    alignItems: 'center',
  },
  favoriteNumberText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  favoriteCover: {
    width: 60,
    height: 60,
    borderRadius: 4,
  },
  favoriteCoverPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 4,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  favoriteInfo: {
    flex: 1,
  },
  favoriteTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  favoriteArtist: {
    fontSize: 13,
    color: '#999',
  },
  emptyFavorites: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  addFavoritesButton: {
    backgroundColor: '#1DB954',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 16,
  },
  addFavoritesButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  collectionSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  collectionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  collectionItem: {
    width: '31%',
    aspectRatio: 1,
    position: 'relative',
  },
  collectionCover: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
  },
  collectionCoverPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  formatIndicator: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 10,
    padding: 4,
  },
  viewAllText: {
    fontSize: 14,
    color: '#1DB954',
    fontWeight: '600',
  },
  logsSection: {
    padding: 16,
  },
  logItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#111',
    borderRadius: 8,
    marginBottom: 8,
  },
  logCover: {
    width: 50,
    height: 50,
    borderRadius: 4,
  },
  logCoverPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 4,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logInfo: {
    flex: 1,
    marginLeft: 12,
  },
  logTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  logArtist: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  starsContainer: {
    flexDirection: 'row',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    marginBottom: 20,
  },
  startButton: {
    backgroundColor: '#1DB954',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  moreText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
    marginTop: 12,
  },
});
