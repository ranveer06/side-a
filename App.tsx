// App.tsx - COMPLETE WITH FAVORITES AND LISTS
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './src/services/supabase';
import type { Session } from '@supabase/supabase-js';

// Screens
import HomeScreen from './src/screens/HomeScreen';
import SearchScreen from './src/screens/SearchScreen';
import CollectionScreen from './src/screens/CollectionScreen';
import ActivityScreen from './src/screens/ActivityScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import PublicListsScreen from './src/screens/PublicListsScreen';
import AlbumDetailScreen from './src/screens/AlbumDetailScreen';
import AlbumTracklistScreen from './src/screens/AlbumTracklistScreen';
import LogModalScreen from './src/screens/LogModalScreen';
import FindUsersScreen from './src/screens/FindUsersScreen';
import EditProfileScreen from './src/screens/EditProfileScreen';
import FollowingScreen from './src/screens/FollowingScreen';
import ManageFavoritesScreen from './src/screens/ManageFavoritesScreen';
import SelectFavoriteAlbumScreen from './src/screens/SelectFavoriteAlbumScreen';
import MyListsScreen from './src/screens/MyListsScreen';
import CreateListScreen from './src/screens/CreateListScreen';
import ListDetailScreen from './src/screens/ListDetailScreen';
import AddToListScreen from './src/screens/AddToListScreen';
import LogCommentsScreen from './src/screens/LogCommentsScreen';
import LogDetailScreen from './src/screens/LogDetailScreen';
import UserProfileScreen from './src/screens/UserProfileScreen';
import ArtistAlbumsScreen from './src/screens/ArtistAlbumsScreen';
import RateTrackScreen from './src/screens/RateTrackScreen';
import RecommendationsScreen from './src/screens/RecommendationsScreen';
import LoginScreen from './src/screens/LoginScreen';
import SignUpScreen from './src/screens/SignUpScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();
const RootStack = createStackNavigator();

// Main tab navigation
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          switch (route.name) {
            case 'Home':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Search':
              iconName = focused ? 'search' : 'search-outline';
              break;
            case 'Collection':
              iconName = focused ? 'albums' : 'albums-outline';
              break;
            case 'Activity':
              iconName = focused ? 'flash' : 'flash-outline';
              break;
            case 'Profile':
              iconName = focused ? 'person' : 'person-outline';
              break;
            default:
              iconName = 'help-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#1DB954',
        tabBarInactiveTintColor: 'gray',
        tabBarStyle: {
          backgroundColor: '#000',
          borderTopColor: '#222',
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Collection" component={CollectionScreen} />
      <Tab.Screen name="Activity" component={ActivityScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// Main app stack with all screens
function AppStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="MainTabs" 
        component={MainTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="AlbumDetail" 
        component={AlbumDetailScreen}
        options={{ 
          title: 'Album',
          headerBackTitle: 'Back',
          headerStyle: {
            backgroundColor: '#000',
          },
          headerTintColor: '#fff',
        }}
      />
      <Stack.Screen 
        name="AlbumTracklist" 
        component={AlbumTracklistScreen}
        options={{ 
          title: 'Tracklist',
          headerStyle: { backgroundColor: '#000' },
          headerTintColor: '#fff',
        }}
      />
      <Stack.Screen 
        name="FindUsers" 
        component={FindUsersScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="PublicLists"
        component={PublicListsScreen}
        options={{ title: 'Discover Lists', headerTitleAlign: 'center', headerStyle: { backgroundColor: '#000' }, headerTintColor: '#fff' }}
      />
      <Stack.Screen 
        name="EditProfile" 
        component={EditProfileScreen}
        options={{ 
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="Following" 
        component={FollowingScreen}
        options={{ 
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="ManageFavorites" 
        component={ManageFavoritesScreen}
        options={{ 
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="SelectFavoriteAlbum" 
        component={SelectFavoriteAlbumScreen}
        options={{ 
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="MyLists" 
        component={MyListsScreen}
        options={{ 
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="CreateList" 
        component={CreateListScreen}
        options={{ 
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="ListDetail" 
        component={ListDetailScreen}
        options={{ 
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="AddToList" 
        component={AddToListScreen}
        options={{ 
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="LogComments" 
        component={LogCommentsScreen}
        options={{ title: 'Comments', headerStyle: { backgroundColor: '#000' }, headerTintColor: '#fff' }}
      />
      <Stack.Screen 
        name="LogDetail" 
        component={LogDetailScreen}
        options={{ title: 'Review', headerStyle: { backgroundColor: '#000' }, headerTintColor: '#fff' }}
      />
      <Stack.Screen 
        name="UserProfile" 
        component={UserProfileScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="ArtistAlbums" 
        component={ArtistAlbumsScreen}
        options={{ headerStyle: { backgroundColor: '#000' }, headerTintColor: '#fff' }}
      />
      <Stack.Screen 
        name="RateTrack" 
        component={RateTrackScreen}
        options={{ title: 'Rate song', headerStyle: { backgroundColor: '#000' }, headerTintColor: '#fff' }}
      />
      <Stack.Screen 
        name="Recommendations" 
        component={RecommendationsScreen}
        options={{ headerShown: false }}
      />
      {/* Log as a modal */}
      <Stack.Screen 
        name="LogModal" 
        component={LogModalScreen}
        options={{ 
          presentation: 'modal',
          title: 'Log Album',
          headerStyle: {
            backgroundColor: '#000',
          },
          headerTintColor: '#fff',
        }}
      />
    </Stack.Navigator>
  );
}

// Auth stack
function AuthStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="Login" 
        component={LoginScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="SignUp" 
        component={SignUpScreen}
        options={{ 
          title: 'Create Account',
          headerBackTitle: 'Back',
          headerStyle: {
            backgroundColor: '#000',
          },
          headerTintColor: '#fff',
        }}
      />
    </Stack.Navigator>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={styles.appLoading}>
        <ActivityIndicator size="large" color="#1DB954" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {session ? (
          <RootStack.Screen name="App" component={AppStack} />
        ) : (
          <RootStack.Screen name="Auth" component={AuthStack} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  appLoading: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
