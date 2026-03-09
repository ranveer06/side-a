// src/services/supabase.ts
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Replace these with your actual Supabase credentials
const supabaseUrl = 'https://cxfrhykvtfhlogodyeep.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4ZnJoeWt2dGZobG9nb2R5ZWVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0OTE3NTUsImV4cCI6MjA4NjA2Nzc1NX0.CucUfmU61WkkbE6IMcbtuQhK0e4PMLzg7OcYp82y5To';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Type definitions for our database
export interface Profile {
  id: string;
  username: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Album {
  id: string;
  musicbrainz_id: string;
  title: string;
  artist: string;
  artist_mbid?: string;
  release_date?: string;
  cover_art_url?: string;
  total_tracks?: number;
  created_at: string;
}

export interface AlbumLog {
  id: string;
  user_id: string;
  album_id: string;
  rating?: number;
  review_text?: string;
  listened_date: string;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface Collection {
  id: string;
  user_id: string;
  album_id: string;
  format: 'vinyl' | 'cd' | 'tape' | 'other';
  condition?: 'mint' | 'near_mint' | 'very_good' | 'good' | 'fair' | 'poor';
  notes?: string;
  purchase_date?: string;
  purchase_price?: number;
  created_at: string;
}

export interface List {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface ListItem {
  id: string;
  list_id: string;
  album_id: string;
  position: number;
  notes?: string;
  added_at: string;
}

export interface LogComment {
  id: string;
  log_id: string;
  user_id: string;
  text: string;
  created_at: string;
}

// Helper functions for common operations

export const authService = {
  signUp: async (email: string, password: string, username: string) => {
    // First, sign up the user
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username, // Store username in user metadata
        }
      }
    });
    
    if (error) throw error;
    
    // Create profile - this happens AFTER auth user is created
    // The RLS policy allows this because auth.uid() now exists
    if (data.user) {
      // Wait a tiny bit for the auth user to be fully created
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([{ 
          id: data.user.id, 
          username: username 
        }]);
      
      if (profileError) {
        console.error('Profile creation error:', profileError);
        throw new Error(`Failed to create profile: ${profileError.message}`);
      }
    }
    
    return data;
  },
  
  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) throw error;
    return data;
  },
  
  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },
  
  getCurrentUser: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },
};

export const profileService = {
  getProfile: async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    return data as Profile;
  },
  
  updateProfile: async (userId: string, updates: Partial<Profile>) => {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    
    if (error) throw error;
    return data as Profile;
  },
};

export const albumLogService = {
  createLog: async (log: Omit<AlbumLog, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase
      .from('album_logs')
      .insert([log])
      .select()
      .single();
    
    if (error) throw error;
    return data as AlbumLog;
  },
  
  getUserLogs: async (userId: string) => {
    const { data, error } = await supabase
      .from('album_logs')
      .select(`
        *,
        albums (*)
      `)
      .eq('user_id', userId)
      .order('listened_date', { ascending: false });
    
    if (error) throw error;
    return data;
  },
  
  updateLog: async (logId: string, updates: Partial<AlbumLog>) => {
    const { data, error } = await supabase
      .from('album_logs')
      .update(updates)
      .eq('id', logId)
      .select()
      .single();
    
    if (error) throw error;
    return data as AlbumLog;
  },
  
  deleteLog: async (logId: string) => {
    const { error } = await supabase
      .from('album_logs')
      .delete()
      .eq('id', logId);
    
    if (error) throw error;
  },
};

export const collectionService = {
  addToCollection: async (collection: Omit<Collection, 'id' | 'created_at'>) => {
    const { data, error } = await supabase
      .from('collections')
      .insert([collection])
      .select()
      .single();
    
    if (error) throw error;
    return data as Collection;
  },
  
  getUserCollection: async (userId: string, format?: string) => {
    let query = supabase
      .from('collections')
      .select(`
        *,
        albums (*)
      `)
      .eq('user_id', userId);
    
    if (format) {
      query = query.eq('format', format);
    }
    
    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },
  
  removeFromCollection: async (collectionId: string) => {
    const { error } = await supabase
      .from('collections')
      .delete()
      .eq('id', collectionId);
    
    if (error) throw error;
  },
};

export const listService = {
  createList: async (list: Omit<List, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase
      .from('lists')
      .insert([list])
      .select()
      .single();
    
    if (error) throw error;
    return data as List;
  },
  
  getUserLists: async (userId: string) => {
    const { data, error } = await supabase
      .from('lists')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    
    if (error) throw error;
    return data as List[];
  },
  
  addAlbumToList: async (listId: string, albumId: string, position: number) => {
    const { data, error } = await supabase
      .from('list_items')
      .insert([{ list_id: listId, album_id: albumId, position }])
      .select()
      .single();
    
    if (error) throw error;
    return data as ListItem;
  },
  
  getListItems: async (listId: string) => {
    const { data, error } = await supabase
      .from('list_items')
      .select(`
        *,
        albums (*)
      `)
      .eq('list_id', listId)
      .order('position');
    
    if (error) throw error;
    return data;
  },
};

export const socialService = {
  followUser: async (followingId: string) => {
    const user = await authService.getCurrentUser();
    if (!user) throw new Error('Not authenticated');
    
    const { error } = await supabase
      .from('follows')
      .insert([{ follower_id: user.id, following_id: followingId }]);
    
    if (error) throw error;
  },
  
  unfollowUser: async (followingId: string) => {
    const user = await authService.getCurrentUser();
    if (!user) throw new Error('Not authenticated');
    
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', user.id)
      .eq('following_id', followingId);
    
    if (error) throw error;
  },
  
  getFollowers: async (userId: string) => {
    const { data, error } = await supabase
      .from('follows')
      .select(`
        follower_id,
        profiles!follows_follower_id_fkey (*)
      `)
      .eq('following_id', userId);
    
    if (error) throw error;
    return data;
  },
  
  getFollowing: async (userId: string) => {
    const { data, error } = await supabase
      .from('follows')
      .select(`
        following_id,
        profiles!follows_following_id_fkey (*)
      `)
      .eq('follower_id', userId);
    
    if (error) throw error;
    return data;
  },
  
  getActivityFeed: async (limit = 20, offset = 0) => {
    const user = await authService.getCurrentUser();
    if (!user) throw new Error('Not authenticated');
    
    const { data, error } = await supabase
      .rpc('get_activity_feed', {
        target_user_id: user.id,
        page_limit: limit,
        page_offset: offset,
      });
    
    if (error) throw error;
    return data;
  },
};

export const logCommentService = {
  getCommentsForLog: async (logId: string) => {
    const { data, error } = await supabase
      .from('log_comments')
      .select('id, log_id, user_id, text, created_at')
      .eq('log_id', logId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data ?? [];
  },

  getCommentCountsForLogs: async (logIds: string[]): Promise<Record<string, number>> => {
    if (logIds.length === 0) return {};
    const { data, error } = await supabase
      .from('log_comments')
      .select('log_id')
      .in('log_id', logIds);

    if (error) throw error;

    const counts: Record<string, number> = {};
    logIds.forEach((id) => { counts[id] = 0; });
    (data ?? []).forEach((row: { log_id: string }) => {
      counts[row.log_id] = (counts[row.log_id] ?? 0) + 1;
    });
    return counts;
  },

  addComment: async (logId: string, text: string): Promise<LogComment> => {
    const user = await authService.getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('log_comments')
      .insert([{ log_id: logId, user_id: user.id, text: text.trim() }])
      .select()
      .single();

    if (error) throw error;
    return data as LogComment;
  },
};

export const logLikeService = {
  getLikeCountsForLogs: async (logIds: string[]): Promise<Record<string, number>> => {
    if (logIds.length === 0) return {};
    const { data, error } = await supabase
      .from('log_likes')
      .select('log_id')
      .in('log_id', logIds);
    if (error) throw error;
    const counts: Record<string, number> = {};
    logIds.forEach((id) => { counts[id] = 0; });
    (data ?? []).forEach((row: { log_id: string }) => {
      counts[row.log_id] = (counts[row.log_id] ?? 0) + 1;
    });
    return counts;
  },

  getLogIdsLikedByUser: async (logIds: string[]): Promise<Set<string>> => {
    const user = await authService.getCurrentUser();
    if (!user || logIds.length === 0) return new Set();
    const { data } = await supabase
      .from('log_likes')
      .select('log_id')
      .eq('user_id', user.id)
      .in('log_id', logIds);
    return new Set((data ?? []).map((row: { log_id: string }) => row.log_id));
  },

  isLikedByUser: async (logId: string): Promise<boolean> => {
    const user = await authService.getCurrentUser();
    if (!user) return false;
    const { data } = await supabase
      .from('log_likes')
      .select('id')
      .eq('log_id', logId)
      .eq('user_id', user.id)
      .maybeSingle();
    return !!data;
  },

  toggleLike: async (logId: string): Promise<{ liked: boolean; count: number }> => {
    const user = await authService.getCurrentUser();
    if (!user) throw new Error('Not authenticated');
    const existing = await supabase
      .from('log_likes')
      .select('id')
      .eq('log_id', logId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (existing.data) {
      await supabase.from('log_likes').delete().eq('log_id', logId).eq('user_id', user.id);
      const { count } = await supabase.from('log_likes').select('*', { count: 'exact', head: true }).eq('log_id', logId);
      return { liked: false, count: count ?? 0 };
    } else {
      await supabase.from('log_likes').insert([{ log_id: logId, user_id: user.id }]);
      const { count } = await supabase.from('log_likes').select('*', { count: 'exact', head: true }).eq('log_id', logId);
      return { liked: true, count: count ?? 1 };
    }
  },
};
