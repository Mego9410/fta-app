import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/Themed';
import type { Listing } from '@/src/domain/types';
import { listFavoriteListings, toggleFavorite } from '@/src/data/favoritesRepo';
import { ListingCard } from '@/src/ui/components/ListingCard';
import { ui } from '@/src/ui/theme';

export default function SavedScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 66;
  const tabBarBottom = Math.max(insets.bottom, ui.spacing.md);
  const bottomPad = tabBarHeight + tabBarBottom + ui.spacing.md;
  const [listings, setListings] = useState<Listing[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const rows = await listFavoriteListings();
    setListings(rows);
  }, []);

  // Reload whenever this tab gains focus so newly-saved listings appear immediately.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (cancelled) return;
        await load();
      })();
      return () => {
        cancelled = true;
      };
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.title}>Saved</Text>
        <Text style={styles.subtitle}>Your favorites, like saved homes.</Text>
      </View>

      <FlatList
        data={listings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingHorizontal: ui.layout.screenPaddingX,
            paddingBottom: bottomPad,
          },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <ListingCard
            listing={item}
            isSaved={true}
            onPress={() =>
              router.push({
                pathname: '/listings/[id]',
                params: { id: item.id },
              })
            }
            onToggleSaved={async () => {
              await toggleFavorite(item.id);
              await load();
            }}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No saved listings</Text>
            <Text style={styles.emptyBody}>Tap the heart on a listing to save it.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: ui.layout.screenPaddingX,
    paddingTop: 16,
    paddingBottom: 6,
    gap: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.75,
    fontWeight: '600',
  },
  listContent: {
    paddingTop: 10,
  },
  empty: {
    paddingTop: 40,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  emptyBody: {
    opacity: 0.75,
  },
});

