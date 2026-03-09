// src/screens/LogDetailScreen.tsx – Review detail with comments and like
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  FlatList,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase, logCommentService, logLikeService, type LogComment } from '../services/supabase';

interface CommentWithProfile extends LogComment {
  username?: string;
  avatar_url?: string | null;
}

interface LogData {
  id: string;
  user_id: string;
  album_id: string;
  rating: number | null;
  review_text: string | null;
  listened_date: string;
  username: string;
  avatar_url: string | null;
  album_title: string;
  artist: string;
  cover_art_url: string | null;
}

export default function LogDetailScreen({ route, navigation }: any) {
  const { logId } = route.params;
  const [logData, setLogData] = useState<LogData | null>(null);
  const [comments, setComments] = useState<CommentWithProfile[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likeBusy, setLikeBusy] = useState(false);

  const loadLogAndComments = useCallback(async () => {
    if (!logId) return;
    try {
      const { data: log, error: logError } = await supabase
        .from('album_logs')
        .select('id, user_id, album_id, rating, review_text, listened_date')
        .eq('id', logId)
        .single();

      if (logError || !log) {
        setLoading(false);
        return;
      }

      const [albumRes, profileRes, commentsData, likedRes, countRes] = await Promise.all([
        supabase.from('albums').select('title, artist, cover_art_url').eq('id', log.album_id).single(),
        supabase.from('profiles').select('username, avatar_url').eq('id', log.user_id).single(),
        logCommentService.getCommentsForLog(logId),
        logLikeService.isLikedByUser(logId),
        supabase.from('log_likes').select('*', { count: 'exact', head: true }).eq('log_id', logId),
      ]);

      const album = albumRes.data;
      const profile = profileRes.data;

      setLogData({
        ...log,
        username: profile?.username ?? 'unknown',
        avatar_url: profile?.avatar_url ?? null,
        album_title: album?.title ?? 'Unknown Album',
        artist: album?.artist ?? 'Unknown Artist',
        cover_art_url: album?.cover_art_url ?? null,
      });

      setLiked(likedRes);
      setLikeCount((countRes.count ?? 0) as number);

      const userIds = [...new Set((commentsData as LogComment[]).map((c) => c.user_id))];
      let profilesMap: Record<string, { username?: string; avatar_url?: string | null }> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', userIds);
        profilesMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, { username: p.username, avatar_url: p.avatar_url }]));
      }

      setComments(
        (commentsData as LogComment[]).map((c) => ({
          ...c,
          username: profilesMap[c.user_id]?.username,
          avatar_url: profilesMap[c.user_id]?.avatar_url,
        }))
      );
    } catch (e) {
      console.error('Error loading log detail:', e);
    } finally {
      setLoading(false);
    }
  }, [logId]);

  useEffect(() => {
    loadLogAndComments();
  }, [loadLogAndComments]);

  useEffect(() => {
    navigation.setOptions({
      title: 'Review',
      headerStyle: { backgroundColor: '#000' },
      headerTintColor: '#fff',
    });
  }, [navigation]);

  const handlePostComment = async () => {
    const trimmed = commentText.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await logCommentService.addComment(logId, trimmed);
      setCommentText('');
      await loadLogAndComments();
    } catch (e) {
      console.error('Error posting comment:', e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleLike = async () => {
    if (likeBusy) return;
    setLikeBusy(true);
    try {
      const result = await logLikeService.toggleLike(logId);
      setLiked(result.liked);
      setLikeCount(result.count);
    } catch (e) {
      console.error('Error toggling like:', e);
    } finally {
      setLikeBusy(false);
    }
  };

  const renderStars = (rating: number | null) => {
    if (!rating) return null;
    return (
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Ionicons
            key={star}
            name={star <= rating ? 'star' : 'star-outline'}
            size={16}
            color="#FFD700"
          />
        ))}
      </View>
    );
  };

  const renderComment = ({ item }: { item: CommentWithProfile }) => (
    <View style={styles.commentRow}>
      <View style={styles.commentAvatar}>
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} style={styles.commentAvatarImg} />
        ) : (
          <Ionicons name="person-circle-outline" size={36} color="#666" />
        )}
      </View>
      <View style={styles.commentBody}>
        <Text style={styles.commentUsername}>@{item.username ?? 'unknown'}</Text>
        <Text style={styles.commentText}>{item.text}</Text>
        <Text style={styles.commentTime}>
          {new Date(item.created_at).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  if (!logData) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Review not found</Text>
      </View>
    );
  }

  const header = (
    <View style={styles.logCard}>
      <TouchableOpacity
        style={styles.logHeader}
        onPress={() => navigation.navigate('UserProfile', { userId: logData.user_id })}
      >
        {logData.avatar_url ? (
          <Image source={{ uri: logData.avatar_url }} style={styles.logAvatar} />
        ) : (
          <View style={styles.logAvatarPlaceholder}>
            <Ionicons name="person-circle-outline" size={40} color="#666" />
          </View>
        )}
        <View style={styles.logHeaderText}>
          <Text style={styles.logUsername}>@{logData.username}</Text>
          <Text style={styles.logMeta}>logged this album</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#666" />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.logAlbumRow}
        onPress={() => navigation.navigate('AlbumDetail', { albumId: logData.album_id })}
      >
        {logData.cover_art_url ? (
          <Image source={{ uri: logData.cover_art_url }} style={styles.logCover} />
        ) : (
          <View style={styles.logCoverPlaceholder}>
            <Ionicons name="disc-outline" size={40} color="#666" />
          </View>
        )}
        <View style={styles.logAlbumInfo}>
          <Text style={styles.logAlbumTitle}>{logData.album_title}</Text>
          <Text style={styles.logArtist}>{logData.artist}</Text>
          {renderStars(logData.rating)}
        </View>
        <Ionicons name="chevron-forward" size={20} color="#666" />
      </TouchableOpacity>

      {logData.review_text ? (
        <Text style={styles.logReview}>{logData.review_text}</Text>
      ) : (
        <Text style={styles.logReviewMuted}>No review text</Text>
      )}

      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.likeButton} onPress={handleToggleLike} disabled={likeBusy}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={22} color={liked ? '#e74c3c' : '#666'} />
          <Text style={[styles.likeCountText, liked && styles.likeCountTextActive]}>{likeCount}</Text>
        </TouchableOpacity>
        <View style={styles.commentsCountBar}>
          <Ionicons name="chatbubble-outline" size={18} color="#666" />
          <Text style={styles.commentsCountText}>{comments.length} comment{comments.length !== 1 ? 's' : ''}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        data={comments}
        keyExtractor={(item) => item.id}
        renderItem={renderComment}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <View style={styles.emptyComments}>
            <Text style={styles.emptyCommentsText}>No comments yet. Be the first!</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Add a comment..."
          placeholderTextColor="#666"
          value={commentText}
          onChangeText={setCommentText}
          multiline
          maxLength={500}
          editable={!submitting}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!commentText.trim() || submitting) && styles.sendButtonDisabled]}
          onPress={handlePostComment}
          disabled={!commentText.trim() || submitting}
        >
          <Ionicons name="send" size={22} color={commentText.trim() && !submitting ? '#1DB954' : '#555'} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  errorText: { color: '#999', fontSize: 16 },
  listContent: { paddingBottom: 24 },
  logCard: {
    backgroundColor: '#111',
    margin: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#222',
  },
  logHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  logAvatar: { width: 40, height: 40, borderRadius: 20 },
  logAvatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#222', justifyContent: 'center', alignItems: 'center' },
  logHeaderText: { marginLeft: 12, flex: 1 },
  logUsername: { fontSize: 15, fontWeight: '600', color: '#fff' },
  logMeta: { fontSize: 13, color: '#999' },
  logAlbumRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  logCover: { width: 72, height: 72, borderRadius: 4 },
  logCoverPlaceholder: { width: 72, height: 72, borderRadius: 4, backgroundColor: '#222', justifyContent: 'center', alignItems: 'center' },
  logAlbumInfo: { marginLeft: 12, flex: 1 },
  logAlbumTitle: { fontSize: 16, fontWeight: '600', color: '#fff' },
  logArtist: { fontSize: 14, color: '#999', marginTop: 2 },
  starsRow: { flexDirection: 'row', marginTop: 4 },
  logReview: { fontSize: 15, color: '#ddd', lineHeight: 22, marginBottom: 12 },
  logReviewMuted: { fontSize: 14, color: '#666', fontStyle: 'italic', marginBottom: 12 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 24 },
  likeButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  likeCountText: { fontSize: 15, color: '#666' },
  likeCountTextActive: { color: '#e74c3c' },
  commentsCountBar: { flexDirection: 'row', alignItems: 'center' },
  commentsCountText: { marginLeft: 6, fontSize: 14, color: '#666' },
  commentRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  commentAvatar: { marginRight: 12 },
  commentAvatarImg: { width: 36, height: 36, borderRadius: 18 },
  commentBody: { flex: 1 },
  commentUsername: { fontSize: 13, fontWeight: '600', color: '#fff', marginBottom: 2 },
  commentText: { fontSize: 14, color: '#ddd', lineHeight: 20 },
  commentTime: { fontSize: 11, color: '#666', marginTop: 4 },
  emptyComments: { padding: 24, alignItems: 'center' },
  emptyCommentsText: { color: '#666', fontSize: 14 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    backgroundColor: '#111',
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  input: {
    flex: 1,
    backgroundColor: '#222',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: { marginLeft: 8, padding: 8, justifyContent: 'center', alignItems: 'center' },
  sendButtonDisabled: { opacity: 0.6 },
});
