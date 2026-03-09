// Wrapper so we can open another user's profile from the stack (e.g. from Find Users or feed).
import React from 'react';
import ProfileScreen from './ProfileScreen';

export default function UserProfileScreen({ route, navigation }: any) {
  return <ProfileScreen route={{ ...route, params: { userId: route.params?.userId } }} navigation={navigation} />;
}
