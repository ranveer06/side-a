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
import { supabase } from '../services/supabase';
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
}

export default function HomeScreen({ navigation }: any) {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

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

      // Get who you're following
      const { data: followingData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);

      const followingIds = new Set(followingData?.map(f => f.following_id) || []);

      // Get ALL logs from everyone (public feed)
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

      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', uniqueUserIds);

      if (profilesError) throw profilesError;

      // Fetch albums
      const { data: albums, error: albumsError } = await supabase
        .from('albums')
        .select('id, title, artist, cover_art_url')
        .in('id', uniqueAlbumIds);

      if (albumsError) throw albumsError;

      // Create lookup maps
      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);
      const albumsMap = new Map(albums?.map(a => [a.id, a]) || []);

      // Combine data
      const feedItems: FeedItem[] = logs.map(log => {
        const profile = profilesMap.get(log.user_id);
        const album = albumsMap.get(log.album_id);

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
          likes_count: 0,
        };
      });

      // Sort: Following first, then everyone else (both by date)
      const sortedFeed = feedItems.sort((a, b) => {
        const aIsFollowing = followingIds.has(a.user_id);
        const bIsFollowing = followingIds.has(b.user_id);
        
        // If one is following and one isn't, following comes first
        if (aIsFollowing && !bIsFollowing) return -1;
        if (!aIsFollowing && bIsFollowing) return 1;
        
        // If both are same category, sort by date (already sorted from query)
        return 0;
      });

      setFeed(sortedFeed);
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

  const renderFeedItem = ({ item }: { item: FeedItem }) => {
    const isOwnLog = item.user_id === currentUserId;
    
    return (
      <TouchableOpacity
        style={styles.feedItem}
        onPress={() => navigation.navigate('AlbumDetail', { albumId: item.album_id })}
      >
        <View style={styles.feedHeader}>
          <View style={styles.avatar}>
            {item.avatar_url ? (
              <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
            ) : (
              <Ionicons name="person-circle-outline" size={40} color="#666" />
            )}
          </View>
          <View style={styles.headerText}>
            <Text style={styles.username}>
              {isOwnLog ? 'You' : `@${item.username}`}
            </Text>
            <Text style={styles.action}>logged an album</Text>
          </View>
          <Text style={styles.timeAgo}>{formatTimeAgo(item.created_at)}</Text>
        </View>

        <View style={styles.albumContent}>
          {item.cover_art_url ? (
            <Image
              source={{ uri: item.cover_art_url }}
              style={styles.albumCover}
            />
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

        <View style={styles.feedFooter}>
          <TouchableOpacity style={styles.likeButton}>
            <Ionicons name="heart-outline" size={20} color="#666" />
            <Text style={styles.likeCount}>{item.likes_count}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.commentButton}>
            <Ionicons name="chatbubble-outline" size={20} color="#666" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

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
    fontSize: 14,
    color: '#666',
  },
  commentButton: {
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
