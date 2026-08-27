import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import useDataStore from '../../state/dataStore';
import usePreferencesStore from '../../state/preferencesStore';
import { saveInterests } from '../../services/preferencesApi';
import { getGuestName } from '../../utils/guestName';
import TopAppBar from '../../components/TopAppBar';

const ProfileScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const brands = useDataStore((state) => state.brands);
  const deals = useDataStore((state) => state.deals);
  const categories = useDataStore((state) => state.categories);
  const favoriteCategories = usePreferencesStore((state) => state.favoriteCategories);
  const toggleCategory = usePreferencesStore((state) => state.toggleCategory);
  const followedBrands = usePreferencesStore((state) => state.followedBrands);
  const [darkMode, setDarkMode] = useState(false);
  const guestName = useMemo(() => getGuestName(), []);

  const handleToggleCategory = (name) => {
    toggleCategory(name);
    saveInterests({ categories: usePreferencesStore.getState().favoriteCategories });
  };

  const otherCategories = useMemo(() => categories.filter((c) => !favoriteCategories.includes(c.name)).slice(0, 4), [categories, favoriteCategories]);

  const rows = [
    {
      icon: 'notifications-outline',
      label: 'Notification Preferences',
      subtitle: 'Manage push and email alerts',
      kind: 'link',
      onPress: () => navigation.navigate('NotificationPreferencesScreen'),
    },
    {
      icon: 'business-outline',
      label: 'Followed Brands',
      subtitle: `${followedBrands.length} of ${brands.length} brands followed`,
      kind: 'link',
      onPress: () => navigation.navigate('FollowedBrandsScreen'),
    },
    { icon: 'moon-outline', label: 'Dark Mode', subtitle: 'Switch app appearance', kind: 'toggle' },
    {
      icon: 'help-circle-outline',
      label: 'Help & Support',
      subtitle: 'FAQ, Contact us',
      kind: 'link',
      onPress: () => navigation.navigate('HelpSupportScreen'),
    },
    {
      icon: 'shield-checkmark-outline',
      label: 'Privacy Policy',
      subtitle: 'How we handle your data',
      kind: 'link',
      onPress: () => navigation.navigate('PrivacyPolicyScreen'),
    },
    {
      icon: 'document-text-outline',
      label: 'Terms & Conditions',
      subtitle: 'Rules for using DealPulse',
      kind: 'link',
      onPress: () => navigation.navigate('TermsConditionsScreen'),
    },
  ];

  return (
    <View style={styles.container}>
      <TopAppBar hideProfile />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 80 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.avatarCard}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Icon name="person" size={36} color="#FFFFFF" />
            </View>
            <View style={styles.editBadge}>
              <Icon name="pencil" size={11} color="#FFFFFF" />
            </View>
          </View>
          <Text style={styles.accountTitle}>{guestName}</Text>
          <Text style={styles.accountSubtitle}>Browsing as a guest</Text>
          <View style={styles.premiumPill}>
            <Icon name="pricetags-outline" size={13} color="#171717" />
            <Text style={styles.premiumPillLabel}>{deals.length} offers tracked</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Deal Preferences</Text>
          <View style={styles.prefCard}>
            <View style={styles.prefHeader}>
              <View style={styles.prefTitleRow}>
                <Icon name="pricetags" size={16} color={COLORS.primary} />
                <Text style={styles.prefTitle}>Favorite Categories</Text>
              </View>
              <Pressable onPress={() => navigation.navigate('FavoriteCategoriesScreen')} hitSlop={8}>
                <Text style={styles.editLink}>EDIT</Text>
              </Pressable>
            </View>
            <Text style={styles.prefBody}>Tailor your feed by selecting what you want to see most.</Text>
            <View style={styles.chipRow}>
              {favoriteCategories.map((c) => (
                <Pressable key={c} onPress={() => handleToggleCategory(c)} style={styles.selectedChip}>
                  <Text style={styles.selectedChipLabel}>{c}</Text>
                  <Icon name="close" size={13} color="#FFFFFF" />
                </Pressable>
              ))}
              {otherCategories.map((c) => (
                <Pressable key={c.name} onPress={() => handleToggleCategory(c.name)} style={styles.addableChip}>
                  <Text style={styles.addableChipLabel}>{c.name}</Text>
                  <Icon name="add" size={13} color="#171717" />
                </Pressable>
              ))}
              {categories.length > favoriteCategories.length + otherCategories.length && (
                <Pressable onPress={() => navigation.navigate('FavoriteCategoriesScreen')} style={styles.moreChip}>
                  <Text style={styles.moreChipLabel}>More...</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>

        <View style={styles.settingsCard}>
          <View style={styles.settingsHeader}>
            <Text style={styles.settingsHeaderLabel}>Account Settings</Text>
          </View>
          {rows.map((row, i) => (
            <Pressable
              key={row.label}
              disabled={row.kind !== 'link' || !row.onPress}
              onPress={row.onPress}
              style={[styles.settingRow, i === rows.length - 1 && styles.settingRowLast]}>
              <View style={styles.settingIconCircle}>
                <Icon name={row.icon} size={18} color="#171717" />
              </View>
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>{row.label}</Text>
                <Text style={styles.settingSubtitle}>{row.subtitle}</Text>
              </View>
              {row.kind === 'toggle' ? (
                <Switch value={darkMode} onValueChange={setDarkMode} trackColor={{ false: '#E5E7EB', true: COLORS.primary }} />
              ) : (
                <Icon name="chevron-forward" size={18} color="#6B7280" />
              )}
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.logoutButton}>
          <Icon name="log-out-outline" size={18} color={COLORS.primary} />
          <Text style={styles.logoutLabel}>Log Out</Text>
        </Pressable>

        <Text style={styles.version}>DealPulse v1.0.0</Text>
      </ScrollView>
    </View>
  );
};

export default ProfileScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: SPACING.four,
    paddingTop: SPACING.four,
    gap: SPACING.five,
  },
  avatarCard: {
    alignItems: 'center',
    gap: SPACING.two,
    backgroundColor: '#FDEEEE',
    borderRadius: RADIUS.card,
    paddingVertical: SPACING.five,
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
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: '#FDEEEE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountTitle: {
    ...TYPOGRAPHY.headline,
  },
  accountSubtitle: {
    ...TYPOGRAPHY.small,
    color: COLORS.textSecondary,
    marginTop: -2,
  },
  premiumPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E5E7EB',
    paddingHorizontal: SPACING.three,
    paddingVertical: 4,
    borderRadius: RADIUS.chip,
    marginTop: 2,
  },
  premiumPillLabel: {
    ...TYPOGRAPHY.small,
  },
  section: {
    gap: SPACING.three,
  },
  sectionTitle: {
    ...TYPOGRAPHY.headline,
  },
  prefCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.card,
    padding: SPACING.three,
    gap: SPACING.two,
  },
  prefHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  prefTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.two,
  },
  prefTitle: {
    ...TYPOGRAPHY.subtitle,
  },
  editLink: {
    ...TYPOGRAPHY.linkPrimary,
  },
  prefBody: {
    ...TYPOGRAPHY.small,
    color: COLORS.textSecondary,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.two,
    marginTop: SPACING.one,
  },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.chip,
    paddingHorizontal: SPACING.three,
    paddingVertical: SPACING.two,
  },
  selectedChipLabel: {
    ...TYPOGRAPHY.smallBold,
    color: '#FFFFFF',
  },
  addableChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8F9FB',
    borderRadius: RADIUS.chip,
    paddingHorizontal: SPACING.three,
    paddingVertical: SPACING.two,
  },
  addableChipLabel: {
    ...TYPOGRAPHY.smallBold,
  },
  moreChip: {
    backgroundColor: '#F8F9FB',
    borderRadius: RADIUS.chip,
    paddingHorizontal: SPACING.three,
    paddingVertical: SPACING.two,
  },
  moreChipLabel: {
    ...TYPOGRAPHY.smallBold,
    color: COLORS.textSecondary,
  },
  settingsCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.card,
    overflow: 'hidden',
  },
  settingsHeader: {
    backgroundColor: '#F8F9FB',
    paddingHorizontal: SPACING.three,
    paddingVertical: SPACING.two,
  },
  settingsHeaderLabel: {
    ...TYPOGRAPHY.subtitle,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.three,
    paddingHorizontal: SPACING.three,
    paddingVertical: SPACING.three,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
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
  settingLabel: {
    ...TYPOGRAPHY.default,
  },
  settingSubtitle: {
    ...TYPOGRAPHY.small,
    color: COLORS.textSecondary,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.two,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.chip,
    paddingVertical: SPACING.three,
  },
  logoutLabel: {
    ...TYPOGRAPHY.label,
    color: COLORS.primary,
  },
  version: {
    ...TYPOGRAPHY.small,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: -SPACING.three,
  },
});
