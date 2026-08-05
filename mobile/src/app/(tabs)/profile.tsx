import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/dealpulse/brand-logo';
import { TopAppBar } from '@/components/dealpulse/top-app-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAppData } from '@/state/data';
import { useFavorites } from '@/state/favorites';

interface SettingsRow {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  kind: 'toggle' | 'link';
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { brands, deals } = useAppData();
  const { favoriteIds } = useFavorites();
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);

  const topBrands = useMemo(
    () => [...brands].sort((a, b) => b.dealCount - a.dealCount).slice(0, 6),
    [brands]
  );

  const rows: SettingsRow[] = [
    { icon: 'moon-outline', label: 'Dark Mode', kind: 'toggle' },
    { icon: 'notifications-outline', label: 'Notifications', kind: 'toggle' },
    { icon: 'lock-closed-outline', label: 'Privacy', kind: 'link' },
    { icon: 'information-circle-outline', label: 'About', kind: 'link' },
    { icon: 'chatbubble-ellipses-outline', label: 'Feedback', kind: 'link' },
    { icon: 'log-out-outline', label: 'Logout', kind: 'link' },
  ];

  return (
    <ThemedView style={styles.container}>
      <TopAppBar hideProfile />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + BottomTabInset }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.avatarBlock}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={32} color="#FFFFFF" />
          </View>
          <ThemedText type="headline">Your Account</ThemedText>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <ThemedText type="title" style={styles.statNumber}>
              {favoriteIds.length}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Favorites
            </ThemedText>
          </View>
          <View style={styles.statCard}>
            <ThemedText type="title" style={styles.statNumber}>
              {brands.length}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Brands
            </ThemedText>
          </View>
          <View style={styles.statCard}>
            <ThemedText type="title" style={styles.statNumber}>
              {deals.length}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Offers
            </ThemedText>
          </View>
        </View>

        {topBrands.length > 0 && (
          <View style={styles.section}>
            <ThemedText type="smallBold" style={styles.sectionLabel}>
              Favorite Brands
            </ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.brandRow}>
              {topBrands.map((b) => (
                <Pressable
                  key={b.id}
                  style={styles.brandItem}
                  onPress={() => router.push(`/brand/${b.id}`)}>
                  <BrandLogo initials={b.initials} size={48} />
                  <ThemedText type="small" numberOfLines={1} style={styles.brandName}>
                    {b.name}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.section}>
          <ThemedText type="smallBold" style={styles.sectionLabel}>
            Settings
          </ThemedText>
          <View style={styles.settingsList}>
            {rows.map((row) => (
              <View key={row.label} style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <Ionicons name={row.icon} size={20} color="#171717" />
                  <ThemedText type="default">{row.label}</ThemedText>
                </View>
                {row.kind === 'toggle' ? (
                  <Switch
                    value={row.label === 'Dark Mode' ? darkMode : notifications}
                    onValueChange={row.label === 'Dark Mode' ? setDarkMode : setNotifications}
                    trackColor={{ false: '#E5E7EB', true: '#171717' }}
                  />
                ) : (
                  <Ionicons name="chevron-forward" size={18} color="#6B7280" />
                )}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.five,
  },
  avatarBlock: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#171717',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    paddingVertical: Spacing.four,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statNumber: {
    fontSize: 22,
  },
  section: {
    gap: Spacing.three,
  },
  sectionLabel: {
    color: '#6B7280',
  },
  brandRow: {
    gap: Spacing.four,
  },
  brandItem: {
    alignItems: 'center',
    gap: Spacing.two,
    width: 72,
  },
  brandName: {
    textAlign: 'center',
  },
  settingsList: {
    gap: 0,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
});
