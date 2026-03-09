// src/screens/PublicListsScreen.tsx – Browse all public lists
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';

interface PublicListRow {
  id: string;
  title: string;
  description?: string;
  user_id: string;
  username: string;
  created_at: string;
}

export default function PublicListsScreen({ navigation }: any) {
  const [lists, setLists] = useState<PublicListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data: listsData, error: listError } = await supabase
        .from('lists')
        .select('id, title, description, user_id, created_at')
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(100);

      if (listError) throw listError;

      const userIds = [...new Set((listsData ?? []).map((l: any) => l.user_id))];
      let profilesMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username')
          .in('id', userIds);
        profilesMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.username]));
      }

      setLists(
        (listsData ?? []).map((l: any) => ({
          ...l,
          username: profilesMap[l.user_id] ?? 'unknown',
        }))
      );
    } catch (e) {
      console.error('Error loading public lists:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    navigation.setOptions({
      headerTitleAlign: 'center',
    });
  }, [navigation]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const renderItem = ({ item }: { item: PublicListRow }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() => navigation.navigate('ListDetail', { listId: item.id })}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="list" size={28} color="#1DB954" />
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.meta}>by @{item.username}</Text>
        {item.description ? (
          <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color="#666" />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  return (
    <FlatList
      data={lists}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Ionicons name="list-outline" size={64} color="#666" />
          <Text style={styles.emptyText}>No public lists yet</Text>
          <Text style={styles.emptySubtext}>Create a list and set it to public to share it.</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  list: { padding: 16, paddingBottom: 32 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#222',
  },
  iconWrap: { marginRight: 14 },
  info: { flex: 1 },
  title: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 2 },
  meta: { fontSize: 13, color: '#999', marginBottom: 4 },
  desc: { fontSize: 13, color: '#bbb' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#fff', marginTop: 16 },
  emptySubtext: { fontSize: 14, color: '#999', marginTop: 8, textAlign: 'center' },
});
