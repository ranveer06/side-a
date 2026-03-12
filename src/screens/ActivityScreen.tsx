// src/screens/ActivityScreen.tsx – Your activity & Following with toggle; includes log, like, comment, collection
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import RemoteImage from '../components/RemoteImage';
import AlbumCover from '../components/AlbumCover';

type ActivityType = 'log' | 'like' | 'comment' | 'collection';

interface ActivityItem {
  id: string;
  type: ActivityType;
  created_at: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  // For log
  log_id?: string;
  album_id?: string;
  album_title?: string;
  artist?: string;
  cover_art_url?: string | null;
  musicbrainz_id?: string | null;
  rating?: number | null;
  review_text?: string | null;
  // For like/comment: the log owner and target album
  target_username?: string;
  target_log_id?: string;
  comment_text?: string;
  // For collection
  format?: string;
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return `${Math.floor(seconds / 604800)}w ago`;
}

export default function ActivityScreen({ navigation }: any) {
  const [mode, setMode] = useState<'yours' | 'following'>('yours');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [yourActivity, setYourActivity] = useState<ActivityItem[]>([]);
  const [followingActivity, setFollowingActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setCurrentUserId(user.id);

      const { data: followingData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);
      const followingIds = new Set((followingData ?? []).map((f: { following_id: string }) => f.following_id));

      const profilesMap = new Map<string, { username: string; avatar_url: string | null }>();
      const albumsMap = new Map<
        string,
        { title: string; artist: string; cover_art_url: string | null; musicbrainz_id: string | null }
      >();
      const logToAlbum = new Map<string, string>();

      const ensureProfiles = async (ids: string[]) => {
        const missing = ids.filter((id) => !profilesMap.has(id));
        if (missing.length === 0) return;
        const { data } = await supabase.from('profiles').select('id, username, avatar_url').in('id', missing);
        (data ?? []).forEach((p: any) => profilesMap.set(p.id, { username: p.username, avatar_url: p.avatar_url }));
      };
      const ensureAlbums = async (ids: string[]) => {
        const missing = ids.filter((id) => !albumsMap.has(id));
        if (missing.length === 0) return;
        const { data } = await supabase
          .from('albums')
          .select('id, title, artist, cover_art_url, musicbrainz_id')
          .in('id', missing);
        (data ?? []).forEach((a: any) =>
          albumsMap.set(a.id, {
            title: a.title,
            artist: a.artist,
            cover_art_url: a.cover_art_url,
            musicbrainz_id: a.musicbrainz_id ?? null,
          })
        );
      };

      const items: ActivityItem[] = [];

      // Logs
      const { data: logs } = await supabase
        .from('album_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      const logUserIds = [...new Set((logs ?? []).map((l: any) => l.user_id))];
      const logAlbumIds = [...new Set((logs ?? []).map((l: any) => l.album_id))];
      await ensureProfiles(logUserIds);
      await ensureAlbums(logAlbumIds);
      (logs ?? []).forEach((l: any) => {
        logToAlbum.set(l.id, l.album_id);
        const profile = profilesMap.get(l.user_id);
        const album = albumsMap.get(l.album_id);
        items.push({
          id: `log-${l.id}`,
          type: 'log',
          created_at: l.created_at,
          user_id: l.user_id,
          username: profile?.username ?? 'unknown',
          avatar_url: profile?.avatar_url ?? null,
          log_id: l.id,
          album_id: l.album_id,
          album_title: album?.title,
          artist: album?.artist,
          cover_art_url: album?.cover_art_url,
          musicbrainz_id: album?.musicbrainz_id,
          rating: l.rating,
          review_text: l.review_text,
        });
      });

      // Likes
      const { data: likes } = await supabase
        .from('log_likes')
        .select('log_id, user_id, created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      if (likes?.length) {
        const likeUserIds = [...new Set(likes.map((l: any) => l.user_id))];
        const logIds = [...new Set(likes.map((l: any) => l.log_id))];
        const { data: logRows } = await supabase.from('album_logs').select('id, user_id, album_id').in('id', logIds);
        const logOwnerIds = [...new Set((logRows ?? []).map((l: any) => l.user_id))];
        const likeAlbumIds = [...new Set((logRows ?? []).map((l: any) => l.album_id))];
        await ensureProfiles(likeUserIds);
        await ensureProfiles(logOwnerIds);
        await ensureAlbums(likeAlbumIds);
        const logRowMap = new Map((logRows ?? []).map((l: any) => [l.id, l]));
        likes.forEach((like: any) => {
          const logRow = logRowMap.get(like.log_id);
          if (!logRow) return;
          const profile = profilesMap.get(like.user_id);
          const ownerProfile = profilesMap.get(logRow.user_id);
          const album = albumsMap.get(logRow.album_id);
          items.push({
            id: `like-${like.log_id}-${like.user_id}`,
            type: 'like',
            created_at: like.created_at,
            user_id: like.user_id,
            username: profile?.username ?? 'unknown',
            avatar_url: profile?.avatar_url ?? null,
            target_username: ownerProfile?.username,
            target_log_id: like.log_id,
            album_title: album?.title,
            artist: album?.artist,
            cover_art_url: album?.cover_art_url,
            musicbrainz_id: album?.musicbrainz_id,
          });
        });
      }

      // Comments
      const { data: comments } = await supabase
        .from('log_comments')
        .select('id, log_id, user_id, text, created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      if (comments?.length) {
        const commentUserIds = [...new Set(comments.map((c: any) => c.user_id))];
        const commentLogIds = [...new Set(comments.map((c: any) => c.log_id))];
        const { data: commentLogRows } = await supabase.from('album_logs').select('id, user_id, album_id').in('id', commentLogIds);
        const commentOwnerIds = [...new Set((commentLogRows ?? []).map((l: any) => l.user_id))];
        const commentAlbumIds = [...new Set((commentLogRows ?? []).map((l: any) => l.album_id))];
        await ensureProfiles(commentUserIds);
        await ensureProfiles(commentOwnerIds);
        await ensureAlbums(commentAlbumIds);
        const commentLogMap = new Map((commentLogRows ?? []).map((l: any) => [l.id, l]));
        comments.forEach((c: any) => {
          const logRow = commentLogMap.get(c.log_id);
          if (!logRow) return;
          const profile = profilesMap.get(c.user_id);
          const ownerProfile = profilesMap.get(logRow.user_id);
          const album = albumsMap.get(logRow.album_id);
          items.push({
            id: `comment-${c.id}`,
            type: 'comment',
            created_at: c.created_at,
            user_id: c.user_id,
            username: profile?.username ?? 'unknown',
            avatar_url: profile?.avatar_url ?? null,
            target_username: ownerProfile?.username,
            target_log_id: c.log_id,
            comment_text: c.text,
            album_title: album?.title,
            artist: album?.artist,
            cover_art_url: album?.cover_art_url,
            musicbrainz_id: album?.musicbrainz_id,
          });
        });
      }

      // Collection adds
      const { data: collections } = await supabase
        .from('collections')
        .select('id, user_id, album_id, format, created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      if (collections?.length) {
        const collUserIds = [...new Set(collections.map((c: any) => c.user_id))];
        const collAlbumIds = [...new Set(collections.map((c: any) => c.album_id))];
        await ensureProfiles(collUserIds);
        await ensureAlbums(collAlbumIds);
        collections.forEach((c: any) => {
          const profile = profilesMap.get(c.user_id);
          const album = albumsMap.get(c.album_id);
          items.push({
            id: `collection-${c.id}`,
            type: 'collection',
            created_at: c.created_at,
            user_id: c.user_id,
            username: profile?.username ?? 'unknown',
            avatar_url: profile?.avatar_url ?? null,
            album_id: c.album_id,
            album_title: album?.title,
            artist: album?.artist,
            cover_art_url: album?.cover_art_url,
            musicbrainz_id: album?.musicbrainz_id,
            format: c.format,
          });
        });
      }

      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const yours = items.filter((i) => i.user_id === user.id).slice(0, 80);
      const following = items.filter((i) => i.user_id !== user.id && followingIds.has(i.user_id)).slice(0, 80);

      setYourActivity(yours);
      setFollowingActivity(following);
    } catch (e) {
      console.error('Activity load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const renderStars = (rating: number | null | undefined) => {
    if (rating == null) return null;
    return (
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((s) => (
          <Ionicons key={s} name={s <= rating ? 'star' : 'star-outline'} size={12} color="#FFD700" />
        ))}
      </View>
    );
  };

  const getSubtitle = (item: ActivityItem): string => {
    const album = item.album_title ? `"${item.album_title}"` : 'an album';
    switch (item.type) {
      case 'log':
        return 'logged an album';
      case 'like':
        return item.target_username ? `liked @${item.target_username}'s review of ${album}` : `liked a review of ${album}`;
      case 'comment':
        return item.target_username ? `commented on @${item.target_username}'s review of ${album}` : `commented on a review of ${album}`;
      case 'collection':
        return `added ${album} to collection${item.format ? ` (${item.format})` : ''}`;
      default:
        return '';
    }
  };

  const onPressItem = (item: ActivityItem) => {
    if (item.type === 'log' && item.log_id) {
      navigation.navigate('LogDetail', { logId: item.log_id });
    } else if ((item.type === 'like' || item.type === 'comment') && item.target_log_id) {
      navigation.navigate('LogDetail', { logId: item.target_log_id });
    } else if (item.type === 'collection' && item.album_id) {
      navigation.navigate('AlbumDetail', { albumId: item.album_id });
    }
  };

  const renderItem = (item: ActivityItem) => (
    <TouchableOpacity
      key={item.id}
      style={styles.card}
      onPress={() => onPressItem(item)}
      activeOpacity={0.8}
    >
      <View style={styles.cardHeader}>
        <RemoteImage uri={item.avatar_url} style={styles.avatar} placeholderIcon="person-circle-outline" />
        <View style={styles.cardHeaderText}>
          <Text style={styles.cardUsername}>
            {item.user_id === currentUserId ? 'You' : `@${item.username}`}
          </Text>
          <Text style={styles.cardMeta}>{getSubtitle(item)}</Text>
        </View>
        <Text style={styles.timeAgo}>{formatTimeAgo(item.created_at)}</Text>
      </View>
      {(item.album_title || item.cover_art_url) && (
        <View style={styles.albumRow}>
          <AlbumCover
            coverArtUrl={item.cover_art_url}
            albumId={item.album_id}
            title={item.album_title}
            artist={item.artist}
            style={styles.cover}
          />
          <View style={styles.albumInfo}>
            <Text style={styles.albumTitle} numberOfLines={1}>{item.album_title ?? 'Album'}</Text>
            {item.artist && <Text style={styles.artist} numberOfLines={1}>{item.artist}</Text>}
            {item.type === 'log' && renderStars(item.rating)}
          </View>
        </View>
      )}
      {item.type === 'comment' && item.comment_text && (
        <Text style={styles.commentPreview} numberOfLines={2}>"{item.comment_text}"</Text>
      )}
    </TouchableOpacity>
  );

  const currentList = mode === 'yours' ? yourActivity : followingActivity;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Activity</Text>
      </View>

      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleTab, mode === 'yours' && styles.toggleTabActive]}
          onPress={() => setMode('yours')}
        >
          <Text style={[styles.toggleText, mode === 'yours' && styles.toggleTextActive]}>Your activity</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleTab, mode === 'following' && styles.toggleTabActive]}
          onPress={() => setMode('following')}
        >
          <Text style={[styles.toggleText, mode === 'following' && styles.toggleTextActive]}>Following</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
      >
        {currentList.length === 0 ? (
          <View style={styles.emptySection}>
            {mode === 'yours' ? (
              <>
                <Ionicons name="musical-notes-outline" size={48} color="#666" />
                <Text style={styles.emptyText}>Your activity will show here</Text>
                <Text style={styles.emptySubtext}>Log albums, like reviews, comment, or add to collection</Text>
                <TouchableOpacity style={styles.linkButton} onPress={() => navigation.navigate('Search')}>
                  <Text style={styles.linkButtonText}>Search albums</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Ionicons name="people-outline" size={48} color="#666" />
                <Text style={styles.emptyText}>Follow users to see their activity</Text>
                <TouchableOpacity style={styles.linkButton} onPress={() => navigation.navigate('FindUsers')}>
                  <Text style={styles.linkButtonText}>Find users</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : (
          currentList.map((item) => renderItem(item))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  header: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#222' },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  toggleRow: { flexDirection: 'row', padding: 16, gap: 12 },
  toggleTab: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#1a1a1a', alignItems: 'center' },
  toggleTabActive: { backgroundColor: '#1DB954' },
  toggleText: { fontSize: 15, fontWeight: '600', color: '#999' },
  toggleTextActive: { color: '#fff' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingTop: 0 },
  emptySection: { alignItems: 'center', paddingVertical: 48, backgroundColor: '#111', borderRadius: 12 },
  emptyText: { fontSize: 17, fontWeight: '600', color: '#fff', marginTop: 16 },
  emptySubtext: { fontSize: 14, color: '#999', marginTop: 6, textAlign: 'center' },
  linkButton: { marginTop: 16, paddingVertical: 10, paddingHorizontal: 20 },
  linkButtonText: { color: '#1DB954', fontSize: 15, fontWeight: '600' },
  card: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#222',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarPlaceholder: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  cardHeaderText: { flex: 1, marginLeft: 10 },
  cardUsername: { fontSize: 14, fontWeight: '600', color: '#fff' },
  cardMeta: { fontSize: 12, color: '#999' },
  timeAgo: { fontSize: 11, color: '#666' },
  albumRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  cover: { width: 48, height: 48, borderRadius: 4 },
  coverPlaceholder: { width: 48, height: 48, borderRadius: 4, backgroundColor: '#222', justifyContent: 'center', alignItems: 'center' },
  albumInfo: { marginLeft: 10, flex: 1 },
  albumTitle: { fontSize: 13, fontWeight: '600', color: '#fff' },
  artist: { fontSize: 12, color: '#999', marginTop: 2 },
  stars: { flexDirection: 'row', marginTop: 2 },
  commentPreview: { fontSize: 12, color: '#bbb', marginTop: 8, fontStyle: 'italic' },
});
