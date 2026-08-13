import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/dealpulse/brand-logo';
import { EmptyState } from '@/components/dealpulse/empty-state';
import { PrimaryButton } from '@/components/dealpulse/primary-button';
import { SearchBar } from '@/components/dealpulse/search-bar';
import { TopAppBar } from '@/components/dealpulse/top-app-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useCreateAlert } from '@/state/alerts';
import { useAppData } from '@/state/data';
import { Brand } from '@/types/dealpulse';

export default function PickBrandScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { brands } = useAppData();
  const { draft, updateDraft } = useCreateAlert();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return brands;
    const q = query.trim().toLowerCase();
    return brands.filter((b) => b.name.toLowerCase().includes(q));
  }, [brands, query]);

  const select = (brand: Brand) => updateDraft({ brandId: brand.id, brandName: brand.name });

  const onContinue = () => router.push('/create-alert/configuration');

  return (
    <ThemedView style={styles.container}>
      <TopAppBar title="Track Brand" showBack hideProfile />
      <View style={styles.searchWrap}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search brands" />
      </View>

      {filtered.length === 0 ? (
        <EmptyState icon="business-outline" title="No brands found" body="Try a different search." />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(b) => b.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const selected = draft.brandId === item.id;
            return (
              <Pressable style={[styles.row, selected && styles.rowSelected]} onPress={() => select(item)}>
                <BrandLogo initials={item.initials} size={44} tone={selected ? 'filled' : 'outline'} />
                <View style={styles.rowText}>
                  <ThemedText type="smallBold" numberOfLines={1}>
                    {item.name}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {item.dealCount} deals
                  </ThemedText>
                </View>
                {selected && <Ionicons name="checkmark-circle" size={22} color="#B7131A" />}
              </Pressable>
            );
          }}
        />
      )}

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.three }]}>
        <PrimaryButton label="Continue" pill disabled={!draft.brandId} onPress={onContinue} />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchWrap: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  list: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
    paddingBottom: Spacing.four,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: '#F0DADA',
    padding: Spacing.three,
    marginBottom: Spacing.two,
  },
  rowSelected: {
    borderColor: '#B7131A',
    borderWidth: 2,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: '#F0DADA',
  },
});
