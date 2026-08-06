import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FilterChip } from '@/components/dealpulse/filter-chip';
import { TopAppBar } from '@/components/dealpulse/top-app-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Radius, Spacing } from '@/constants/theme';
import { useAppData } from '@/state/data';
import { useFavorites } from '@/state/favorites';
import { usePreferences } from '@/state/preferences';

interface SettingsRow {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle: string;
  kind: 'toggle' | 'link';
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { brands, deals, categories } = useAppData();
  const { favoriteIds } = useFavorites();
  const { favoriteCategories, toggleCategory } = usePreferences();
  const [darkMode, setDarkMode] = useState(false);

  const otherCategories = useMemo(
    () => categories.filter((c) => !favoriteCategories.includes(c.name)).slice(0, 4),
    [categories, favoriteCategories]
  );

  const rows: SettingsRow[] = [
    {
      icon: 'notifications-outline',
      label: 'Notification Preferences',
      subtitle: 'Manage push and email alerts',
      kind: 'link',
    },
    {
      icon: 'business-outline',
      label: 'Followed Brands',
      subtitle: `${brands.length} brands tracked`,
      kind: 'link',
    },
    { icon: 'moon-outline', label: 'Dark Mode', subtitle: 'Switch app appearance', kind: 'toggle' },
    { icon: 'help-circle-outline', label: 'Help & Support', subtitle: 'FAQ, Contact us', kind: 'link' },
  ];

  return (
    <ThemedView style={styles.container}>
      <TopAppBar hideProfile />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + BottomTabInset }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.avatarCard}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={36} color="#FFFFFF" />
            </View>
            <View style={styles.editBadge}>
              <Ionicons name="pencil" size={11} color="#FFFFFF" />
            </View>
          </View>
          <ThemedText type="headline">Your Account</ThemedText>
          <View style={styles.premiumPill}>
            <Ionicons name="pricetags-outline" size={13} color="#171717" />
            <ThemedText type="small">{deals.length} offers tracked</ThemedText>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="headline">Your Deal Preferences</ThemedText>
          <View style={styles.prefCard}>
            <View style={styles.prefHeader}>
              <View style={styles.prefTitleRow}>
                <Ionicons name="pricetags" size={16} color="#B7131A" />
                <ThemedText type="subtitle">Favorite Categories</ThemedText>
              </View>
              <ThemedText type="linkPrimary">EDIT</ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              Tailor your feed by selecting what you want to see most.
            </ThemedText>
            <View style={styles.chipRow}>
              {favoriteCategories.map((c) => (
                <Pressable key={c} onPress={() => toggleCategory(c)} style={styles.selectedChip}>
                  <ThemedText type="smallBold" style={styles.selectedChipLabel}>
                    {c}
                  </ThemedText>
                  <Ionicons name="close" size={13} color="#FFFFFF" />
                </Pressable>
              ))}
              {otherCategories.map((c) => (
                <Pressable key={c.name} onPress={() => toggleCategory(c.name)} style={styles.addableChip}>
                  <ThemedText type="smallBold">{c.name}</ThemedText>
                  <Ionicons name="add" size={13} color="#171717" />
                </Pressable>
              ))}
              {categories.length > favoriteCategories.length + otherCategories.length && (
                <View style={styles.moreChip}>
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    More...
                  </ThemedText>
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={styles.settingsCard}>
          <View style={styles.settingsHeader}>
            <ThemedText type="subtitle">Account Settings</ThemedText>
          </View>
          {rows.map((row, i) => (
            <View
              key={row.label}
              style={[styles.settingRow, i === rows.length - 1 && styles.settingRowLast]}>
              <View style={styles.settingIconCircle}>
                <Ionicons name={row.icon} size={18} color="#171717" />
              </View>
              <View style={styles.settingText}>
                <ThemedText type="default">{row.label}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {row.subtitle}
                </ThemedText>
              </View>
              {row.kind === 'toggle' ? (
                <Switch value={darkMode} onValueChange={setDarkMode} trackColor={{ false: '#E5E7EB', true: '#B7131A' }} />
              ) : (
                <Ionicons name="chevron-forward" size={18} color="#6B7280" />
              )}
            </View>
          ))}
        </View>

        <Pressable style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={18} color="#B7131A" />
          <ThemedText type="label" style={styles.logoutLabel}>
            Log Out
          </ThemedText>
        </Pressable>

        <ThemedText type="small" themeColor="textSecondary" style={styles.version}>
          DealPulse v1.0.0
        </ThemedText>
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
  avatarCard: {
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: '#FDEEEE',
    borderRadius: Radius.card,
    paddingVertical: Spacing.five,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#171717',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#B7131A',
    borderWidth: 2,
    borderColor: '#FDEEEE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E5E7EB',
    paddingHorizontal: Spacing.three,
    paddingVertical: 4,
    borderRadius: Radius.chip,
    marginTop: 2,
  },
  section: {
    gap: Spacing.three,
  },
  prefCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0DADA',
    borderRadius: Radius.card,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  prefHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  prefTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#B7131A',
    borderRadius: Radius.chip,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  selectedChipLabel: {
    color: '#FFFFFF',
  },
  addableChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8F9FB',
    borderRadius: Radius.chip,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  moreChip: {
    backgroundColor: '#F8F9FB',
    borderRadius: Radius.chip,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  settingsCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0DADA',
    borderRadius: Radius.card,
    overflow: 'hidden',
  },
  settingsHeader: {
    backgroundColor: '#F8F9FB',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: '#F0DADA',
  },
  settingRowLast: {
    borderBottomWidth: 0,
  },
  settingIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingText: {
    flex: 1,
    gap: 1,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: '#B7131A',
    borderRadius: Radius.chip,
    paddingVertical: Spacing.three,
  },
  logoutLabel: {
    color: '#B7131A',
  },
  version: {
    textAlign: 'center',
    marginTop: -Spacing.three,
  },
});
