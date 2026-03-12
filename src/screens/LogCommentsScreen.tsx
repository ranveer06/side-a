// src/screens/LogCommentsScreen.tsx
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase, logCommentService, commentLikeService, type LogComment } from '../services/supabase';
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

export default function LogCommentsScreen({ route, navigation }: any) {
  const logId = route.params?.logId;
  const [logData, setLogData] = useState<LogData | null>(null);
  const [comments, setComments] = useState<CommentWithProfile[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);
  const [replyingToUsername, setReplyingToUsername] = useState<string | null>(null);
  const [likeBusyCommentId, setLikeBusyCommentId] = useState<string | null>(null);

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

      const [albumRes, profileRes, commentsData] = await Promise.all([
        supabase.from('albums').select('title, artist, cover_art_url, musicbrainz_id').eq('id', log.album_id).single(),
        supabase.from('profiles').select('username, avatar_url').eq('id', log.user_id).single(),
        logCommentService.getCommentsForLog(logId),
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

      const rawComments = commentsData as (LogComment & { parent_id?: string | null })[];
      const userIds = [...new Set(rawComments.map((c) => c.user_id))];
      const parentIds = [...new Set(rawComments.map((c) => c.parent_id).filter(Boolean) as string[])];
      const allUserIds = [...new Set([...userIds, ...parentIds])];
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
          const parent_username = parentComment ? profilesMap[parentComment.user_id]?.username ?? null : null;
          return {
            ...c,
            username: profilesMap[c.user_id]?.username,
            avatar_url: profilesMap[c.user_id]?.avatar_url,
            parent_username,
            likes_count: likeCounts[c.id] ?? 0,
            is_liked: likedSet.has(c.id),
          };
        })
      );
    } catch (e) {
      console.error('Error loading log comments:', e);
    } finally {
      setLoading(false);
    }
  }, [logId]);

  useEffect(() => {
    if (logId) loadLogAndComments();
    else setLoading(false);
  }, [logId, loadLogAndComments]);

  useEffect(() => {
    const replyingToId = route.params?.replyingToCommentId;
    const replyingToName = route.params?.replyingToUsername;
    if (replyingToId && replyingToName) {
      setReplyingToCommentId(replyingToId);
      setReplyingToUsername(replyingToName);
    }
  }, [route.params?.replyingToCommentId, route.params?.replyingToUsername]);

  useEffect(() => {
    navigation.setOptions({
      title: 'Comments',
      headerStyle: { backgroundColor: '#000' },
      headerTintColor: '#fff',
    });
  }, [navigation]);

  const handlePostComment = async () => {
    const trimmed = commentText.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await logCommentService.addComment(logId, trimmed, replyingToCommentId ?? undefined);
      setCommentText('');
      setReplyingToCommentId(null);
      setReplyingToUsername(null);
      await loadLogAndComments();
    } catch (e) {
      console.error('Error posting comment:', e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCommentLike = async (commentId: string) => {
    if (likeBusyCommentId) return;
    setLikeBusyCommentId(commentId);
    try {
      const result = await commentLikeService.toggleLike(commentId);
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId ? { ...c, is_liked: result.liked, likes_count: result.count } : c
        )
      );
    } catch (_) {}
    setLikeBusyCommentId(null);
  };

  const renderStars = (rating: number | null) => {
    if (!rating) return null;
    return (
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Ionicons
            key={star}
            name={star <= rating ? 'star' : 'star-outline'}
            size={14}
            color="#FFD700"
          />
        ))}
      </View>
    );
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
            <Ionicons
              name={item.is_liked ? 'heart' : 'heart-outline'}
              size={16}
              color={item.is_liked ? '#e74c3c' : '#666'}
            />
            <Text style={[styles.commentLikeCount, item.is_liked && styles.commentLikeCountActive]}>{item.likes_count ?? 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.commentReplyBtn}
            onPress={() => {
              setReplyingToCommentId(item.id);
              setReplyingToUsername(item.username ?? null);
            }}
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
        <Text style={styles.errorText}>Log not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
        ListHeaderComponent={
          <View style={styles.logCard}>
            <View style={styles.logHeader}>
              <RemoteImage uri={logData.avatar_url} style={styles.logAvatar} placeholderIcon="person-circle-outline" />
              <View style={styles.logHeaderText}>
                <Text style={styles.logUsername}>@{logData.username}</Text>
                <Text style={styles.logMeta}>logged this album</Text>
              </View>
            </View>
            <View style={styles.logAlbumRow}>
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
            </View>
            {logData.review_text ? (
              <Text style={styles.logReview} numberOfLines={4}>{logData.review_text}</Text>
            ) : null}
            <View style={styles.commentsCountBar}>
              <Ionicons name="chatbubble-outline" size={18} color="#666" />
              <Text style={styles.commentsCountText}>{comments.length} comment{comments.length !== 1 ? 's' : ''}</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyComments}>
            <Text style={styles.emptyCommentsText}>No comments yet. Be the first!</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />

      <View style={styles.inputRow}>
        {replyingToUsername && (
          <View style={styles.replyingToBar}>
            <Text style={styles.replyingToText}>Reply to @{replyingToUsername}</Text>
            <TouchableOpacity onPress={() => { setReplyingToCommentId(null); setReplyingToUsername(null); }}>
              <Ionicons name="close" size={18} color="#666" />
            </TouchableOpacity>
          </View>
        )}
        <TextInput
          style={styles.input}
          placeholder={replyingToUsername ? `Reply to @${replyingToUsername}...` : 'Add a comment...'}
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
  errorText: {
    color: '#999',
    fontSize: 16,
  },
  backButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#333',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  listContent: {
    paddingBottom: 24,
  },
  logCard: {
    backgroundColor: '#111',
    margin: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#222',
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  logAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  logAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logHeaderText: {
    marginLeft: 12,
  },
  logUsername: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  logMeta: {
    fontSize: 13,
    color: '#999',
  },
  logAlbumRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  logCover: {
    width: 56,
    height: 56,
    borderRadius: 4,
  },
  logCoverPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 4,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logAlbumInfo: {
    marginLeft: 12,
    justifyContent: 'center',
    flex: 1,
  },
  logAlbumTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  logArtist: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  starsRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  logReview: {
    fontSize: 14,
    color: '#ddd',
    lineHeight: 20,
    marginBottom: 12,
  },
  commentsCountBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentsCountText: {
    marginLeft: 6,
    fontSize: 13,
    color: '#666',
  },
  commentRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  commentRowReply: {
    marginLeft: 24,
    borderLeftWidth: 2,
    borderLeftColor: '#333',
    paddingLeft: 12,
  },
  commentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  commentReplyTo: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  commentActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 16,
  },
  commentLikeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  commentLikeCount: {
    fontSize: 12,
    color: '#666',
  },
  commentLikeCountActive: {
    color: '#e74c3c',
  },
  commentReplyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  commentReplyText: {
    fontSize: 12,
    color: '#666',
  },
  replyingToBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#1a1a1a',
    borderRadius: 6,
    marginBottom: 8,
  },
  replyingToText: {
    fontSize: 13,
    color: '#999',
  },
  commentAvatar: {
    marginRight: 12,
  },
  commentAvatarImg: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  commentBody: {
    flex: 1,
  },
  commentUsername: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  commentText: {
    fontSize: 14,
    color: '#ddd',
    lineHeight: 20,
  },
  commentTime: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
  emptyComments: {
    padding: 24,
    alignItems: 'center',
  },
  emptyCommentsText: {
    color: '#666',
    fontSize: 14,
  },
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
    paddingTop: 10,
    color: '#fff',
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    marginLeft: 8,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
});
