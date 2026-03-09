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
import { supabase, albumLogService, profileService, authService, socialService, listService, listenListService } from '../services/supabase';

type ProfileTab = 'Profile' | 'Diary' | 'Lists' | 'ListenList';

export default function ProfileScreen({ route, navigation }: any) {
  // Check if viewing another user's profile
  const viewingUserId = route?.params?.userId;
  const isOwnProfile = !viewingUserId;

  const [activeTab, setActiveTab] = useState<ProfileTab>('Profile');
  const [profile, setProfile] = useState<any>(null);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [collection, setCollection] = useState<any[]>([]);
  const [userLists, setUserLists] = useState<any[]>([]);
  const [listenList, setListenList] = useState<any[]>([]);
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
  const [isFollowingViewingUser, setIsFollowingViewingUser] = useState(false);

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

      // When viewing another user, check if current user follows them
      let followingViewing = false;
      if (viewingUserId && user && user.id !== viewingUserId) {
        const { data: followRow } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id)
          .eq('following_id', viewingUserId)
          .maybeSingle();
        followingViewing = !!followRow;
      }
      setIsFollowingViewingUser(followingViewing);

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

      if (profileUserId === user?.id) {
        try {
          const listsData = await listService.getUserLists(profileUserId);
          const listsWithCounts = await Promise.all(
            (listsData || []).map(async (list: any) => {
              const { count } = await supabase
                .from('list_items')
                .select('*', { count: 'exact', head: true })
                .eq('list_id', list.id);
              return { ...list, item_count: count || 0 };
            })
          );
          setUserLists(listsWithCounts);
        } catch (e) {
          console.warn('Lists load failed:', e);
        }
        try {
          const listenData = await listenListService.getListenList(profileUserId);
          setListenList(listenData);
        } catch (e) {
          console.warn('Listen list load failed:', e);
        }
      }
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
          <Text style={styles.headerTitle}>
            {isOwnProfile ? 'Profile' : `@${profile?.username ?? 'User'}`}
          </Text>
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

        {/* Follow button when viewing another user's profile */}
        {!isOwnProfile && (
          <TouchableOpacity
            style={[styles.followProfileButton, isFollowingViewingUser && styles.followProfileButtonFollowing]}
            onPress={async () => {
              if (!viewingUserId) return;
              try {
                if (isFollowingViewingUser) {
                  await socialService.unfollowUser(viewingUserId);
                  setIsFollowingViewingUser(false);
                } else {
                  await socialService.followUser(viewingUserId);
                  setIsFollowingViewingUser(true);
                }
              } catch (e: any) {
                Alert.alert('Error', e.message || 'Could not update follow');
              }
            }}
          >
            <Text style={[styles.followProfileButtonText, isFollowingViewingUser && styles.followProfileButtonTextFollowing]}>
              {isFollowingViewingUser ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
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

      {/* Toggle bar - only for own profile */}
      {isOwnProfile && (
        <View style={styles.toggleBar}>
          {(['Profile', 'Diary', 'Lists', 'ListenList'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.toggleTab, activeTab === tab && styles.toggleTabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.toggleTabText, activeTab === tab && styles.toggleTabTextActive]}>
                {tab === 'ListenList' ? 'Listen' : tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Tab content - only when own profile */}
      {isOwnProfile && activeTab === 'Profile' && (
        <>
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
            {isOwnProfile && (
              <TouchableOpacity onPress={() => navigation.navigate('Collection')}>
                <Text style={styles.viewAllText}>View All ({stats.collectionCount})</Text>
              </TouchableOpacity>
            )}
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

      {/* Recent Logs - only in Profile tab */}
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
            {logs.slice(0, 5).map(renderLogItem)}
            {logs.length > 5 && (
              <TouchableOpacity onPress={() => setActiveTab('Diary')}>
                <Text style={styles.moreText}>View all in Diary →</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
        </>
      )}

      {isOwnProfile && activeTab === 'Diary' && (
        <View style={styles.diarySection}>
          <Text style={styles.sectionTitle}>Diary</Text>
          <Text style={styles.sectionSubtext}>All your reviews</Text>
          {logs.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="journal-outline" size={48} color="#666" />
              <Text style={styles.emptyText}>No reviews yet</Text>
              <TouchableOpacity
                style={styles.startButton}
                onPress={() => navigation.navigate('Search')}
              >
                <Text style={styles.startButtonText}>Log an album</Text>
              </TouchableOpacity>
            </View>
          ) : (
            logs.map((log) => {
              const sameAlbumLogs = logs
                .filter((l: any) => l.album_id === log.album_id)
                .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
              const isRelisten = sameAlbumLogs.length > 1 && sameAlbumLogs[0].id !== log.id;
              return (
                <TouchableOpacity
                  key={log.id}
                  style={styles.diaryItem}
                  onPress={() => navigation.navigate('LogDetail', { logId: log.id })}
                >
                  {log.albums?.cover_art_url ? (
                    <Image source={{ uri: log.albums.cover_art_url }} style={styles.logCover} />
                  ) : (
                    <View style={styles.logCoverPlaceholder}>
                      <Ionicons name="disc-outline" size={24} color="#666" />
                    </View>
                  )}
                  <View style={styles.logInfo}>
                    <View style={styles.diaryTitleRow}>
                      <Text style={styles.logTitle} numberOfLines={1}>{log.albums?.title || 'Unknown'}</Text>
                      {isRelisten && (
                        <View style={styles.relistenBadge}>
                          <Ionicons name="repeat" size={10} color="#1DB954" />
                          <Text style={styles.relistenText}>Relisten</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.logArtist} numberOfLines={1}>{log.albums?.artist || 'Unknown'}</Text>
                    {log.review_text ? (
                      <Text style={styles.diarySnippet} numberOfLines={2}>{log.review_text}</Text>
                    ) : null}
                    {renderStars(log.rating || 0)}
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#666" />
                </TouchableOpacity>
              );
            })
          )}
        </View>
      )}

      {isOwnProfile && activeTab === 'Lists' && (
        <View style={styles.listsTabSection}>
          <Text style={styles.sectionTitle}>My Lists</Text>
          {userLists.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="list-outline" size={48} color="#666" />
              <Text style={styles.emptyText}>No lists yet</Text>
              <TouchableOpacity
                style={styles.startButton}
                onPress={() => navigation.navigate('MyLists')}
              >
                <Text style={styles.startButtonText}>Create a list</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {userLists.map((list) => (
                <TouchableOpacity
                  key={list.id}
                  style={styles.listTabItem}
                  onPress={() => navigation.navigate('ListDetail', { listId: list.id })}
                >
                  <Ionicons name="list" size={24} color="#1DB954" />
                  <View style={styles.listTabItemInfo}>
                    <Text style={styles.listTabItemTitle}>{list.title}</Text>
                    <Text style={styles.listTabItemCount}>{list.item_count ?? 0} albums</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#666" />
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.viewAllListsButton}
                onPress={() => navigation.navigate('MyLists')}
              >
                <Text style={styles.viewAllListsText}>Manage lists</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {isOwnProfile && activeTab === 'ListenList' && (
        <View style={styles.listenListSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Listen list</Text>
            <TouchableOpacity
              style={styles.addToListenButton}
              onPress={() => navigation.navigate('Search')}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.addToListenButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.sectionSubtext}>Albums you want to listen to</Text>
          {listenList.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="headset-outline" size={48} color="#666" />
              <Text style={styles.emptyText}>Nothing in your listen list</Text>
              <TouchableOpacity
                style={styles.startButton}
                onPress={() => navigation.navigate('Search')}
              >
                <Text style={styles.startButtonText}>Find albums to add</Text>
              </TouchableOpacity>
            </View>
          ) : (
            listenList.map((item: any) => (
              <TouchableOpacity
                key={item.id}
                style={styles.diaryItem}
                onPress={() => navigation.navigate('AlbumDetail', { albumId: item.album_id })}
              >
                {item.albums?.cover_art_url ? (
                  <Image source={{ uri: item.albums.cover_art_url }} style={styles.logCover} />
                ) : (
                  <View style={styles.logCoverPlaceholder}>
                    <Ionicons name="disc-outline" size={24} color="#666" />
                  </View>
                )}
                <View style={styles.logInfo}>
                  <Text style={styles.logTitle} numberOfLines={1}>{item.albums?.title || 'Unknown'}</Text>
                  <Text style={styles.logArtist} numberOfLines={1}>{item.albums?.artist || 'Unknown'}</Text>
                </View>
                <TouchableOpacity
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  onPress={async () => {
                    try {
                      await listenListService.removeFromListenList(item.id);
                      setListenList((prev) => prev.filter((x: any) => x.id !== item.id));
                    } catch (e: any) {
                      Alert.alert('Error', e.message || 'Could not remove');
                    }
                  }}
                >
                  <Ionicons name="close-circle-outline" size={24} color="#666" />
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          )}
        </View>
      )}

      {!isOwnProfile && (
        <>
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
          </View>
          <View style={styles.favoritesSection}>
            <Text style={styles.sectionTitle}>Five Favorites</Text>
            {favorites.length > 0 ? (
              <View style={styles.favoritesList}>
                {favorites.map((fav, index) => renderFavoriteAlbum(fav, index))}
              </View>
            ) : (
              <Text style={styles.emptyText}>No favorites set</Text>
            )}
          </View>
          {stats.collectionCount > 0 && (
            <View style={styles.collectionSection}>
              <Text style={styles.sectionTitle}>Collection</Text>
              <View style={styles.collectionGrid}>
                {collection.slice(0, 6).map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.collectionItem}
                    onPress={() => navigation.navigate('AlbumDetail', { albumId: item.album_id })}
                  >
                    {item.albums?.cover_art_url ? (
                      <Image source={{ uri: item.albums.cover_art_url }} style={styles.collectionCover} />
                    ) : (
                      <View style={styles.collectionCoverPlaceholder}>
                        <Ionicons name="disc-outline" size={30} color="#666" />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
          <View style={styles.logsSection}>
            <Text style={styles.sectionTitle}>Recent Logs</Text>
            {logs.slice(0, 10).map(renderLogItem)}
          </View>
        </>
      )}
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
  followProfileButton: {
    marginTop: 16,
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: '#1DB954',
  },
  followProfileButtonFollowing: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
  },
  followProfileButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  followProfileButtonTextFollowing: {
    color: '#999',
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
  toggleBar: {
    flexDirection: 'row',
    backgroundColor: '#111',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 10,
    padding: 4,
  },
  toggleTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  toggleTabActive: {
    backgroundColor: '#1DB954',
  },
  toggleTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
  },
  toggleTabTextActive: {
    color: '#fff',
  },
  sectionSubtext: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
  },
  diarySection: {
    padding: 16,
  },
  diaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#111',
    borderRadius: 8,
    marginBottom: 8,
  },
  diaryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  relistenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(29, 185, 84, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  relistenText: {
    fontSize: 10,
    color: '#1DB954',
    fontWeight: '600',
  },
  diarySnippet: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  listsTabSection: {
    padding: 16,
  },
  listTabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#111',
    borderRadius: 8,
    marginBottom: 8,
    gap: 12,
  },
  listTabItemInfo: {
    flex: 1,
  },
  listTabItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  listTabItemCount: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  viewAllListsButton: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  viewAllListsText: {
    fontSize: 15,
    color: '#1DB954',
    fontWeight: '600',
  },
  listenListSection: {
    padding: 16,
  },
  addToListenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1DB954',
  },
  addToListenButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
