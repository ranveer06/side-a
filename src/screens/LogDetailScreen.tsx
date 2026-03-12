// src/screens/LogDetailScreen.tsx – Review detail with comments and like
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { supabase, logCommentService, logLikeService, commentLikeService, albumLogService, trackLogService, type LogComment } from '../services/supabase';
import RemoteImage from '../components/RemoteImage';
import AlbumCover from '../components/AlbumCover';

interface CommentWithProfile extends LogComment {
  username?: string;
  avatar_url?: string | null;
  parent_username?: string | null;
  likes_count?: number;
  is_liked?: boolean;
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
  musicbrainz_id?: string | null;
}

export default function LogDetailScreen({ route, navigation }: any) {
  const logId = route.params?.logId;
  const [logData, setLogData] = useState<LogData | null>(null);
  const [comments, setComments] = useState<CommentWithProfile[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likeBusy, setLikeBusy] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [trackLogs, setTrackLogs] = useState<any[]>([]);
  const [showTrackRatings, setShowTrackRatings] = useState(false);
  const [likeBusyCommentId, setLikeBusyCommentId] = useState<string | null>(null);

  useEffect(() => {
    if (!logId) setLoading(false);
  }, [logId]);

  const loadLogAndComments = useCallback(async () => {
    if (!logId) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);

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
        supabase.from('albums').select('title, artist, cover_art_url, musicbrainz_id').eq('id', log.album_id).single(),
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
        musicbrainz_id: album?.musicbrainz_id ?? null,
      });

      setLiked(likedRes);
      setLikeCount((countRes.count ?? 0) as number);

      const rawComments = commentsData as (LogComment & { parent_id?: string | null })[];
      const userIds = [...new Set(rawComments.map((c) => c.user_id))];
      const parentAuthors = new Map<string, string>();
      rawComments.forEach((c) => {
        if (c.parent_id) {
          const parent = rawComments.find((r) => r.id === c.parent_id);
          if (parent) parentAuthors.set(c.id, parent.user_id);
        }
      });
      const allUserIds = [...new Set([...userIds, ...Array.from(parentAuthors.values())])];
      let profilesMap: Record<string, { username?: string; avatar_url?: string | null }> = {};
      if (allUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', allUserIds);
        profilesMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, { username: p.username, avatar_url: p.avatar_url }]));
      }

      const commentIds = rawComments.map((c) => c.id);
      const [likeCounts, likedSet] = await Promise.all([
        commentLikeService.getLikeCountsForComments(commentIds).catch(() => ({})),
        commentLikeService.getCommentIdsLikedByUser(commentIds).catch(() => new Set<string>()),
      ]);

      setComments(
        rawComments.map((c) => {
          const parentComment = c.parent_id ? rawComments.find((r) => r.id === c.parent_id) : null;
          return {
            ...c,
            username: profilesMap[c.user_id]?.username,
            avatar_url: profilesMap[c.user_id]?.avatar_url,
            parent_username: parentComment ? profilesMap[parentComment.user_id]?.username ?? null : null,
            likes_count: likeCounts[c.id] ?? 0,
            is_liked: likedSet.has(c.id),
          };
        })
      );

      const trackLogList = await trackLogService.getForUserAlbum(log.user_id, log.album_id).catch(() => []);
      setTrackLogs(trackLogList.filter((tl: any) => tl.rating != null || (tl.review_text && tl.review_text.trim())));
    } catch (e) {
      console.error('Error loading log detail:', e);
    } finally {
      setLoading(false);
    }
  }, [logId]);

  useEffect(() => {
    loadLogAndComments();
  }, [loadLogAndComments]);

  const handleDeleteLog = () => {
    Alert.alert(
      'Delete review',
      'Are you sure you want to delete this review? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await albumLogService.deleteLog(logId);
              if (navigation.canGoBack()) navigation.goBack();
              else navigation.navigate('Home');
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Could not delete');
            }
          },
        },
      ]
    );
  };

  useEffect(() => {
    const isOwnLog = logData && currentUserId === logData.user_id;
    navigation.setOptions({
      title: 'Review',
      headerStyle: { backgroundColor: '#000' },
      headerTintColor: '#fff',
      headerRight: isOwnLog
        ? () => (
            <TouchableOpacity onPress={handleDeleteLog} style={{ marginRight: 16 }}>
              <Ionicons name="trash-outline" size={22} color="#e74c3c" />
            </TouchableOpacity>
          )
        : undefined,
    });
  }, [navigation, logData, currentUserId]);

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

  const handleCommentLike = async (commentId: string) => {
    if (likeBusyCommentId) return;
    setLikeBusyCommentId(commentId);
    try {
      const result = await commentLikeService.toggleLike(commentId);
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, is_liked: result.liked, likes_count: result.count } : c))
      );
    } catch (_) {}
    setLikeBusyCommentId(null);
  };

  const renderComment = ({ item }: { item: CommentWithProfile }) => (
    <View style={[styles.commentRow, item.parent_id && styles.commentRowReply]}>
      <View style={styles.commentAvatar}>
        <RemoteImage uri={item.avatar_url} style={styles.commentAvatarImg} placeholderIcon="person-circle-outline" />
      </View>
      <View style={styles.commentBody}>
        <View style={styles.commentHeaderRow}>
          <Text style={styles.commentUsername}>@{item.username ?? 'unknown'}</Text>
          {item.parent_id && item.parent_username && (
            <Text style={styles.commentReplyTo}> · reply to @{item.parent_username}</Text>
          )}
        </View>
        <Text style={styles.commentText}>{item.text}</Text>
        <View style={styles.commentActionsRow}>
          <Text style={styles.commentTime}>
            {new Date(item.created_at).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
          <TouchableOpacity
            style={styles.commentLikeBtn}
            onPress={() => handleCommentLike(item.id)}
            disabled={likeBusyCommentId === item.id}
          >
            <Ionicons name={item.is_liked ? 'heart' : 'heart-outline'} size={16} color={item.is_liked ? '#e74c3c' : '#666'} />
            <Text style={[styles.commentLikeCount, item.is_liked && styles.commentLikeCountActive]}>{item.likes_count ?? 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.commentReplyBtn}
            onPress={() => navigation.navigate('LogComments', { logId, replyingToCommentId: item.id, replyingToUsername: item.username })}
          >
            <Ionicons name="arrow-undo-outline" size={14} color="#666" />
            <Text style={styles.commentReplyText}>Reply</Text>
          </TouchableOpacity>
        </View>
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

  if (!logId || !logData) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Review not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const header = (
    <View style={styles.logCard}>
      <TouchableOpacity
        style={styles.logHeader}
        onPress={() => navigation.navigate('UserProfile', { userId: logData.user_id })}
      >
        <RemoteImage uri={logData.avatar_url} style={styles.logAvatar} placeholderIcon="person-circle-outline" />
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
        <AlbumCover
          coverArtUrl={logData.cover_art_url}
          albumId={logData.album_id}
          title={logData.album_title}
          artist={logData.artist}
          style={styles.logCover}
        />
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

      {trackLogs.length > 0 && (
        <View style={styles.trackRatingsBlock}>
          <TouchableOpacity
            style={styles.trackRatingsHeader}
            onPress={() => setShowTrackRatings((v) => !v)}
            activeOpacity={0.8}
          >
            <Text style={styles.trackRatingsTitle}>
              Track ratings ({trackLogs.length})
            </Text>
            <Ionicons name={showTrackRatings ? 'chevron-up' : 'chevron-down'} size={22} color="#999" />
          </TouchableOpacity>
          {showTrackRatings && (
            <View style={styles.trackRatingsList}>
              {trackLogs
                .sort((a: any, b: any) => a.track_number - b.track_number)
                .map((tl: any) => (
                  <View key={tl.id} style={styles.trackRatingItem}>
                    <View style={styles.trackRatingRow}>
                      <Text style={styles.trackRatingNum}>{tl.track_number}.</Text>
                      <Text style={styles.trackRatingName} numberOfLines={1}>{tl.track_name || 'Track'}</Text>
                      {renderStars(tl.rating)}
                    </View>
                    {tl.review_text && tl.review_text.trim() ? (
                      <Text style={styles.trackRatingNote} numberOfLines={3}>{tl.review_text.trim()}</Text>
                    ) : null}
                  </View>
                ))}
            </View>
          )}
        </View>
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
  backButton: { marginTop: 24, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: '#333', borderRadius: 8 },
  backButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
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
  trackRatingsBlock: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#222' },
  trackRatingsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  trackRatingsTitle: { fontSize: 15, fontWeight: '600', color: '#fff' },
  trackRatingsList: { marginTop: 10 },
  trackRatingItem: { marginBottom: 12 },
  trackRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  trackRatingNum: { fontSize: 13, color: '#666', minWidth: 20 },
  trackRatingName: { flex: 1, fontSize: 14, color: '#ddd' },
  trackRatingNote: { fontSize: 13, color: '#999', marginTop: 4, marginLeft: 28 },
  commentRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  commentRowReply: { marginLeft: 24, borderLeftWidth: 2, borderLeftColor: '#333', paddingLeft: 12 },
  commentHeaderRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  commentReplyTo: { fontSize: 11, color: '#666', marginLeft: 4 },
  commentActionsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 12 },
  commentLikeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  commentLikeCount: { fontSize: 11, color: '#666' },
  commentLikeCountActive: { color: '#e74c3c' },
  commentReplyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  commentReplyText: { fontSize: 11, color: '#666' },
  commentAvatar: { marginRight: 12 },
  commentAvatarImg: { width: 36, height: 36, borderRadius: 18 },
  commentBody: { flex: 1 },
  commentUsername: { fontSize: 13, fontWeight: '600', color: '#fff', marginBottom: 2 },
  commentText: { fontSize: 14, color: '#ddd', lineHeight: 20 },
  commentTime: { fontSize: 11, color: '#666' },
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
