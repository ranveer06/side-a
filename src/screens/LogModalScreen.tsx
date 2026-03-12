// src/screens/LogModalScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase, albumLogService } from '../services/supabase';
import RemoteImage from '../components/RemoteImage';
import AlbumCover from '../components/AlbumCover';

export default function LogModalScreen({ route, navigation }: any) {
  const { album, albumId } = route.params || {};

  const [albumData, setAlbumData] = useState(album || null);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [listenedDate, setListenedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!album);

  useEffect(() => {
    if (!album && albumId) {
      loadAlbum(albumId);
    }
  }, [albumId]);

  const loadAlbum = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('albums')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setAlbumData(data);
    } catch (error) {
      console.error('Error loading album:', error);
      Alert.alert('Error', 'Failed to load album');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLog = async () => {
    if (!albumData) {
      Alert.alert('Error', 'No album selected');
      return;
    }

    if (!rating || rating < 0.5) {
      Alert.alert('Rating Required', 'Please select a rating (tap or drag the stars)');
      return;
    }

    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        Alert.alert('Error', 'You must be logged in to log an album');
        setSaving(false);
        return;
      }

      await albumLogService.createLog({
        user_id: user.id,
        album_id: albumData.id,
        rating,
        review_text: reviewText.trim() || undefined,
        listened_date: listenedDate,
        is_favorite: isFavorite,
      });

      Alert.alert('Success', 'Album logged successfully!', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error: any) {
      console.error('Error saving log:', error);
      Alert.alert('Error', error.message || 'Failed to save log. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const renderStarSelector = () => {
    return (
      <View style={styles.starSelector}>
        {[1, 2, 3, 4, 5].map((star) => {
          const full = rating >= star;
          const half = rating >= star - 0.5 && rating < star;
          const name = full ? 'star' : half ? 'star-half' : 'star-outline';
          const leftValue = star - 0.5;
          const rightValue = star;
          return (
            <View key={star} style={styles.starButton}>
              <TouchableOpacity
                style={styles.starHalfTouch}
                activeOpacity={0.7}
                onPress={() => setRating(leftValue)}
              />
              <View style={styles.starIconWrap} pointerEvents="none">
                <Ionicons
                  name={name}
                  size={44}
                  color={full || half ? '#FFD700' : '#666'}
                />
              </View>
              <TouchableOpacity
                style={styles.starHalfTouch}
                activeOpacity={0.7}
                onPress={() => setRating(rightValue)}
              />
            </View>
          );
        })}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  if (!albumData) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#666" />
        <Text style={styles.errorText}>Album not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Album Info */}
      <View style={styles.albumInfo}>
        <AlbumCover
          coverArtUrl={albumData.cover_art_url}
          albumId={albumData.id}
          title={albumData.title}
          artist={albumData.artist}
          style={styles.coverArt}
        />
        <View style={styles.albumText}>
          <Text style={styles.albumTitle}>{albumData.title}</Text>
          <Text style={styles.albumArtist}>{albumData.artist}</Text>
          {albumData.release_date && (
            <Text style={styles.albumYear}>
              {new Date(albumData.release_date).getFullYear()}
            </Text>
          )}
        </View>
      </View>

      {/* Rating */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Rating *</Text>
        {renderStarSelector()}
        {rating >= 0.5 && (
          <Text style={styles.ratingText}>{rating} / 5 stars</Text>
        )}
      </View>

      {/* Review */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Review (Optional)</Text>
        <TextInput
          style={styles.reviewInput}
          placeholder="What did you think of this album?"
          placeholderTextColor="#666"
          multiline
          numberOfLines={6}
          value={reviewText}
          onChangeText={setReviewText}
          textAlignVertical="top"
        />
        <Text style={styles.charCount}>{reviewText.length} characters</Text>
      </View>

      {/* Date */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Date Listened</Text>
        <View style={styles.dateContainer}>
          <Ionicons name="calendar-outline" size={20} color="#999" />
          <Text style={styles.dateText}>{listenedDate}</Text>
        </View>
        <Text style={styles.dateHelp}>Defaults to today</Text>
      </View>

      {/* Favorite */}
      <TouchableOpacity
        style={styles.favoriteButton}
        onPress={() => setIsFavorite(!isFavorite)}
        activeOpacity={0.7}
      >
        <Ionicons
          name={isFavorite ? 'heart' : 'heart-outline'}
          size={24}
          color={isFavorite ? '#FF0000' : '#666'}
        />
        <Text style={[styles.favoriteText, isFavorite && styles.favoriteTextActive]}>
          Mark as favorite
        </Text>
      </TouchableOpacity>

      {/* Save Button */}
      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={handleSaveLog}
        disabled={saving}
        activeOpacity={0.8}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="checkmark-circle-outline" size={24} color="#fff" />
            <Text style={styles.saveButtonText}>Save Log</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  contentContainer: {
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  errorText: {
    fontSize: 18,
    color: '#999',
    marginTop: 16,
  },
  albumInfo: {
    flexDirection: 'row',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    backgroundColor: '#111',
  },
  coverArt: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  coverPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  albumText: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  albumTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  albumArtist: {
    fontSize: 16,
    color: '#999',
    marginBottom: 4,
  },
  albumYear: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  starSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 12,
  },
  starButton: {
    width: 48,
    height: 52,
    flexDirection: 'row',
  },
  starHalfTouch: {
    flex: 1,
    height: '100%',
  },
  starIconWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingText: {
    textAlign: 'center',
    color: '#FFD700',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  reviewInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    minHeight: 140,
    borderWidth: 1,
    borderColor: '#333',
  },
  charCount: {
    textAlign: 'right',
    color: '#666',
    fontSize: 12,
    marginTop: 8,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  dateText: {
    fontSize: 16,
    color: '#fff',
  },
  dateHelp: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
  },
  favoriteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  favoriteText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  favoriteTextActive: {
    color: '#FF0000',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1DB954',
    margin: 20,
    padding: 18,
    borderRadius: 12,
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});

