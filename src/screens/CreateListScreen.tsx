// src/screens/CreateListScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';

export default function CreateListScreen({ navigation }: any) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a list title');
      return;
    }

    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      const { data, error } = await supabase
        .from('lists')
        .insert({
          user_id: user.id,
          title: title.trim(),
          description: description.trim() || null,
          is_public: isPublic,
        })
        .select()
        .single();

      if (error) throw error;

      // Navigate to the new list
      navigation.replace('ListDetail', { listId: data.id });
    } catch (error: any) {
      console.error('Error creating list:', error);
      Alert.alert('Error', error.message || 'Failed to create list');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create List</Text>
        <TouchableOpacity onPress={handleCreate} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color="#1DB954" />
          ) : (
            <Text style={styles.createText}>Create</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Title *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g., Best Albums of the 60s"
              placeholderTextColor="#666"
              maxLength={100}
              autoFocus
            />
            <Text style={styles.hint}>{title.length}/100</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="What's this list about?"
              placeholderTextColor="#666"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={300}
            />
            <Text style={styles.hint}>{description.length}/300</Text>
          </View>

          <View style={styles.switchGroup}>
            <View style={styles.switchInfo}>
              <Text style={styles.label}>Public List</Text>
              <Text style={styles.switchHint}>
                {isPublic 
                  ? 'Everyone can see this list' 
                  : 'Only you can see this list'}
              </Text>
            </View>
            <Switch
              value={isPublic}
              onValueChange={setIsPublic}
              trackColor={{ false: '#3e3e3e', true: '#1DB954' }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={20} color="#1DB954" />
            <Text style={styles.infoText}>
              After creating your list, you'll be able to add albums to it!
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  createText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1DB954',
  },
  content: {
    flex: 1,
  },
  form: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    paddingHorizontal: 16,
    height: 50,
    color: '#fff',
    fontSize: 16,
  },
  textArea: {
    height: 120,
    paddingVertical: 12,
  },
  hint: {
    fontSize: 12,
    color: '#666',
    marginTop: 6,
    textAlign: 'right',
  },
  switchGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 12,
  },
  switchInfo: {
    flex: 1,
  },
  switchHint: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#1DB954',
    gap: 12,
  },
  infoText: {
    flex: 1,
    color: '#ddd',
    fontSize: 14,
    lineHeight: 20,
  },
});
