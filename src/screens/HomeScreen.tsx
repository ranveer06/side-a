// src/screens/HomeScreen.tsx - FIXED QUERY
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Image,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { supabase, logCommentService, logLikeService } from '../services/supabase';
import { Ionicons } from '@expo/vector-icons';

interface FeedItem {
  log_id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  album_id: string;
  album_title: string;
  artist: string;
  cover_art_url: string | null;
  rating: number | null;
  review_text: string | null;
  listened_date: string;
  created_at: string;
  likes_count: number;
  comments_count: number;
  is_liked?: boolean;
  is_relisten?: boolean;
}

interface TopReviewedAlbum {
  album_id: string;
  title: string;
  artist: string;
  cover_art_url: string | null;
  review_count: number;
}

export default function HomeScreen({ navigation }: any) {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [topReviewed, setTopReviewed] = useState<TopReviewedAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [likingLogId, setLikingLogId] = useState<string | null>(null);

  useEffect(() => {
    loadFeed();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadFeed();
    });
    return unsubscribe;
  }, [navigation]);

  const loadFeed = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      setCurrentUserId(user.id);

      // Get all logs, most recent first (public activity feed)
      const { data: logs, error: logsError } = await supabase
        .from('album_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (logsError) throw logsError;

      if (!logs || logs.length === 0) {
        setFeed([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Get unique user IDs and album IDs
      const uniqueUserIds = [...new Set(logs.map(log => log.user_id))];
      const uniqueAlbumIds = [...new Set(logs.map(log => log.album_id))];

      // Fetch profiles (don't fail feed if this errors)
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', uniqueUserIds);
      if (profilesError) console.warn('Feed profiles:', profilesError);

      // Fetch albums (don't fail feed if this errors)
      const { data: albums, error: albumsError } = await supabase
        .from('albums')
        .select('id, title, artist, cover_art_url')
        .in('id', uniqueAlbumIds);
      if (albumsError) console.warn('Feed albums:', albumsError);

      // Create lookup maps
      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);
      const albumsMap = new Map(albums?.map(a => [a.id, a]) || []);

      const logIds = logs.map((log) => log.id);
      let commentCounts: Record<string, number> = {};
      let likeCounts: Record<string, number> = {};
      let likedSet = new Set<string>();
      try {
        const [comments, likes, liked] = await Promise.all([
          logCommentService.getCommentCountsForLogs(logIds),
          logLikeService.getLikeCountsForLogs(logIds),
          logLikeService.getLogIdsLikedByUser(logIds),
        ]);
        commentCounts = comments;
        likeCounts = likes;
        likedSet = liked;
      } catch (e) {
        console.warn('Comments/likes not available:', e);
      }

      let topReviewedData: TopReviewedAlbum[] = [];
      try {
        const { data: topLogs } = await supabase
          .from('album_logs')
          .select('album_id')
          .limit(500);
        const albumCounts: Record<string, number> = {};
        (topLogs ?? []).forEach((row: { album_id: string }) => {
          albumCounts[row.album_id] = (albumCounts[row.album_id] ?? 0) + 1;
        });
        const topAlbumIds = Object.entries(albumCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([id]) => id);
        if (topAlbumIds.length > 0) {
          const { data: topAlbums } = await supabase
            .from('albums')
            .select('id, title, artist, cover_art_url')
            .in('id', topAlbumIds);
          const byId = new Map((topAlbums ?? []).map((a: any) => [a.id, a]));
          topReviewedData = topAlbumIds.map((id) => ({
            album_id: id,
            title: byId.get(id)?.title ?? 'Unknown',
            artist: byId.get(id)?.artist ?? 'Unknown',
            cover_art_url: byId.get(id)?.cover_art_url ?? null,
            review_count: albumCounts[id],
          }));
        }
      } catch (e) {
        console.warn('Top reviewed section failed:', e);
      }
      setTopReviewed(topReviewedData);

      const sameUserAlbumOrder = (userId: string, albumId: string) => {
        const same = logs
          .filter((l: any) => l.user_id === userId && l.album_id === albumId)
          .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        return same;
      };

      const feedItems: FeedItem[] = logs.map(log => {
        const profile = profilesMap.get(log.user_id);
        const album = albumsMap.get(log.album_id);
        const sameUserLogs = sameUserAlbumOrder(log.user_id, log.album_id);
        const isRelisten = sameUserLogs.length > 1 && sameUserLogs[0].id !== log.id;

        return {
          log_id: log.id,
          user_id: log.user_id,
          username: profile?.username || 'unknown',
          avatar_url: profile?.avatar_url || null,
          album_id: log.album_id,
          album_title: album?.title || 'Unknown Album',
          artist: album?.artist || 'Unknown Artist',
          cover_art_url: album?.cover_art_url || null,
          rating: log.rating,
          review_text: log.review_text,
          listened_date: log.listened_date,
          created_at: log.created_at,
          likes_count: likeCounts[log.id] ?? 0,
          comments_count: commentCounts[log.id] ?? 0,
          is_liked: likedSet.has(log.id),
          is_relisten: isRelisten,
        };
      });

      // Keep strict chronological order: most recent public activity first
      setFeed(feedItems);
    } catch (error) {
      console.error('Error loading feed:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadFeed();
  }, []);

  const renderStars = (rating: number | null) => {
    if (!rating) return null;
    
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Ionicons
            key={star}
            name={star <= rating ? 'star' : star - 0.5 <= rating ? 'star-half' : 'star-outline'}
            size={16}
            color="#FFD700"
          />
        ))}
      </View>
    );
  };

  const handleLike = async (logId: string) => {
    if (likingLogId) return;
    setLikingLogId(logId);
    try {
      const result = await logLikeService.toggleLike(logId);
      setFeed((prev) =>
        prev.map((f) =>
          f.log_id === logId
            ? { ...f, likes_count: result.count, is_liked: result.liked }
            : f
        )
      );
    } catch (e: any) {
      console.error('Like error:', e?.message ?? e);
      // Refetch feed so counts stay correct
      loadFeed();
    } finally {
      setLikingLogId(null);
    }
  };

  const renderFeedItem = ({ item }: { item: FeedItem }) => {
    const isOwnLog = item.user_id === currentUserId;

    return (
      <View style={styles.feedItem}>
        <View style={styles.feedHeader}>
          <TouchableOpacity
            style={styles.feedHeaderTouchable}
            onPress={() => {
              if (isOwnLog) navigation.navigate('Profile');
              else navigation.navigate('UserProfile', { userId: item.user_id });
            }}
          >
            <View style={styles.avatar}>
              {item.avatar_url ? (
                <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
              ) : (
                <Ionicons name="person-circle-outline" size={40} color="#666" />
              )}
            </View>
            <View style={styles.headerText}>
              <View style={styles.headerTitleRow}>
                <Text style={styles.username}>
                  {isOwnLog ? 'You' : `@${item.username}`}
                </Text>
                {item.is_relisten && (
                  <View style={styles.relistenBadge}>
                    <Ionicons name="repeat" size={10} color="#1DB954" />
                    <Text style={styles.relistenText}>Relisten</Text>
                  </View>
                )}
              </View>
              <Text style={styles.action}>logged an album</Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.timeAgo}>{formatTimeAgo(item.created_at)}</Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => navigation.navigate('LogDetail', { logId: item.log_id })}
        >

          <View style={styles.albumContent}>
            {item.cover_art_url ? (
              <Image source={{ uri: item.cover_art_url }} style={styles.albumCover} />
            ) : (
              <View style={styles.albumCoverPlaceholder}>
                <Ionicons name="disc-outline" size={40} color="#666" />
              </View>
            )}
            <View style={styles.albumInfo}>
              <Text style={styles.albumTitle} numberOfLines={1}>
                {item.album_title}
              </Text>
              <Text style={styles.artist} numberOfLines={1}>
                {item.artist}
              </Text>
              {renderStars(item.rating)}
            </View>
          </View>

          {item.review_text && (
            <Text style={styles.reviewText} numberOfLines={3}>
              {item.review_text}
            </Text>
          )}
        </TouchableOpacity>

        <View style={styles.feedFooter}>
          <TouchableOpacity
            style={styles.likeButton}
            onPress={() => handleLike(item.log_id)}
            disabled={likingLogId === item.log_id}
          >
            <Ionicons
              name={item.is_liked ? 'heart' : 'heart-outline'}
              size={20}
              color={item.is_liked ? '#e74c3c' : '#666'}
            />
            <Text style={[styles.likeCount, item.is_liked && { color: '#e74c3c' }]}>{item.likes_count}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.commentButton}
            onPress={() => navigation.navigate('LogDetail', { logId: item.log_id })}
          >
            <Ionicons name="chatbubble-outline" size={20} color="#666" />
            <Text style={styles.commentCount}>{item.comments_count}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderListHeader = () => (
    <>
      <TouchableOpacity
        style={styles.discoverListsRow}
        onPress={() => navigation.navigate('PublicLists')}
        activeOpacity={0.8}
      >
        <View style={styles.discoverListsIconWrap}>
          <Ionicons name="list" size={24} color="#1DB954" />
        </View>
        <Text style={styles.discoverListsTitle}>Discover public lists</Text>
        <Ionicons name="chevron-forward" size={20} color="#666" />
      </TouchableOpacity>
      {topReviewed.length > 0 && (
        <View style={styles.topReviewedSection}>
          <Text style={styles.topReviewedTitle}>Most reviewed</Text>
          <View style={styles.topReviewedRow}>
            {topReviewed.map((album) => (
              <TouchableOpacity
                key={album.album_id}
                style={styles.topReviewedItem}
                onPress={() => navigation.navigate('AlbumDetail', { albumId: album.album_id })}
              >
                {album.cover_art_url ? (
                  <Image source={{ uri: album.cover_art_url }} style={styles.topReviewedCover} />
                ) : (
                  <View style={styles.topReviewedCoverPlaceholder}>
                    <Ionicons name="disc-outline" size={28} color="#666" />
                  </View>
                )}
                <Text style={styles.topReviewedAlbumTitle} numberOfLines={1}>
                  {album.title}
                </Text>
                <Text style={styles.topReviewedCount}>{album.review_count} reviews</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </>
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
        <Text style={styles.headerTitle}>Side A</Text>
        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={() => {
            setRefreshing(true);
            loadFeed();
          }}
        >
          <Ionicons name="refresh" size={24} color="#1DB954" />
        </TouchableOpacity>
      </View>
      
      {feed.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="musical-notes-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>No activity yet</Text>
          <Text style={styles.emptySubtext}>
            Log some albums or follow users to see activity!
          </Text>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Search')}
          >
            <Text style={styles.actionButtonText}>Start Logging</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={feed}
          renderItem={renderFeedItem}
          keyExtractor={(item) => item.log_id}
          ListHeaderComponent={renderListHeader()}
          contentContainerStyle={styles.feedList}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </View>
  );
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return `${Math.floor(seconds / 604800)}w`;
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
    backgroundColor: '#000',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  refreshButton: {
    padding: 4,
  },
  feedList: {
    paddingBottom: 20,
  },
  feedItem: {
    backgroundColor: '#111',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    padding: 16,
  },
  feedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  feedHeaderTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#333',
  },
  headerText: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  username: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  action: {
    fontSize: 13,
    color: '#999',
  },
  timeAgo: {
    fontSize: 12,
    color: '#666',
  },
  albumContent: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  albumCover: {
    width: 80,
    height: 80,
    borderRadius: 4,
    backgroundColor: '#333',
  },
  albumCoverPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 4,
    backgroundColor: '#333',
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
  artist: {
    fontSize: 14,
    color: '#999',
    marginBottom: 8,
  },
  starsContainer: {
    flexDirection: 'row',
  },
  reviewText: {
    fontSize: 14,
    color: '#ddd',
    lineHeight: 20,
    marginBottom: 12,
  },
  feedFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  likeCount: {
    marginLeft: 6,
    fontSize: 15,
    fontWeight: '700',
    color: '#ddd',
    minWidth: 20,
  },
  commentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
  },
  commentCount: {
    marginLeft: 6,
    fontSize: 15,
    fontWeight: '700',
    color: '#ddd',
    minWidth: 20,
  },
  discoverListsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    backgroundColor: '#111',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#222',
  },
  discoverListsIconWrap: {
    marginRight: 12,
  },
  discoverListsTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  topReviewedSection: {
    padding: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  topReviewedTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
    marginBottom: 12,
  },
  topReviewedRow: {
    flexDirection: 'row',
    gap: 12,
  },
  topReviewedItem: {
    width: 100,
    alignItems: 'center',
  },
  topReviewedCover: {
    width: 100,
    height: 100,
    borderRadius: 4,
  },
  topReviewedCoverPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 4,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topReviewedAlbumTitle: {
    fontSize: 12,
    color: '#fff',
    marginTop: 6,
  },
  topReviewedCount: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
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
  actionButton: {
    backgroundColor: '#1DB954',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
