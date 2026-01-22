import { Stack } from 'expo-router';

export default function ProfileLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="search-preferences" />
      <Stack.Screen name="details" />
      <Stack.Screen name="my-submissions" />
      <Stack.Screen name="delete-account" />
      {/* Admin routes live under /profile/admin/* */}
      <Stack.Screen name="admin/index" />
      <Stack.Screen name="admin/new" />
      <Stack.Screen name="admin/edit/[id]" />
      <Stack.Screen name="admin/leads" />
    </Stack>
  );
}

