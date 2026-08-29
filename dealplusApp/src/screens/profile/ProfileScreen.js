import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { RADIUS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import useTheme from '../../hooks/useTheme';
import useDataStore from '../../state/dataStore';
import usePreferencesStore from '../../state/preferencesStore';
import { saveInterests } from '../../services/preferencesApi';
import { getGuestName } from '../../utils/guestName';
import TopAppBar from '../../components/TopAppBar';

const ProfileScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors, isDark, toggleTheme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const brands = useDataStore((state) => state.brands);
  const deals = useDataStore((state) => state.deals);
  const categories = useDataStore((state) => state.categories);
  const favoriteCategories = usePreferencesStore((state) => state.favoriteCategories);
  const toggleCategory = usePreferencesStore((state) => state.toggleCategory);
  const followedBrands = usePreferencesStore((state) => state.followedBrands);
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
    {
      icon: 'storefront-outline',
      label: 'Request a Brand',
      subtitle: "Can't find a brand? Let us know",
      kind: 'link',
      onPress: () => navigation.navigate('RequestBrandScreen'),
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
            <Icon name="pricetags-outline" size={13} color={colors.text} />
            <Text style={styles.premiumPillLabel}>{deals.length} offers tracked</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Deal Preferences</Text>
          <View style={styles.prefCard}>
            <View style={styles.prefHeader}>
              <View style={styles.prefTitleRow}>
                <Icon name="pricetags" size={16} color={colors.primary} />
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
                  <Icon name="add" size={13} color={colors.text} />
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
                <Icon name={row.icon} size={18} color={colors.text} />
              </View>
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>{row.label}</Text>
                <Text style={styles.settingSubtitle}>{row.subtitle}</Text>
              </View>
              {row.kind === 'toggle' ? (
                <Switch value={isDark} onValueChange={toggleTheme} trackColor={{ false: colors.border, true: colors.primary }} />
              ) : (
                <Icon name="chevron-forward" size={18} color={colors.textSecondary} />
              )}
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.logoutButton}>
          <Icon name="log-out-outline" size={18} color={colors.primary} />
          <Text style={styles.logoutLabel}>Log Out</Text>
        </Pressable>

        <Text style={styles.version}>DealPulse v1.0.0</Text>
      </ScrollView>
    </View>
  );
};

export default ProfileScreen;

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      paddingHorizontal: SPACING.four,
      paddingTop: SPACING.four,
      gap: SPACING.five,
    },
    avatarCard: {
      alignItems: 'center',
      gap: SPACING.two,
      backgroundColor: colors.errorTint,
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
      backgroundColor: colors.inverseSurface,
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
      backgroundColor: colors.primary,
      borderWidth: 2,
      borderColor: colors.errorTint,
      alignItems: 'center',
      justifyContent: 'center',
    },
    accountTitle: {
      ...TYPOGRAPHY.headline,
      color: colors.text,
    },
    accountSubtitle: {
      ...TYPOGRAPHY.small,
      color: colors.textSecondary,
      marginTop: -2,
    },
    premiumPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.backgroundElement,
      paddingHorizontal: SPACING.three,
      paddingVertical: 4,
      borderRadius: RADIUS.chip,
      marginTop: 2,
    },
    premiumPillLabel: {
      ...TYPOGRAPHY.small,
      color: colors.text,
    },
    section: {
      gap: SPACING.three,
    },
    sectionTitle: {
      ...TYPOGRAPHY.headline,
      color: colors.text,
    },
    prefCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
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
      color: colors.text,
    },
    editLink: {
      ...TYPOGRAPHY.linkPrimary,
    },
    prefBody: {
      ...TYPOGRAPHY.small,
      color: colors.textSecondary,
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
      backgroundColor: colors.primary,
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
      backgroundColor: colors.backgroundElement,
      borderRadius: RADIUS.chip,
      paddingHorizontal: SPACING.three,
      paddingVertical: SPACING.two,
    },
    addableChipLabel: {
      ...TYPOGRAPHY.smallBold,
      color: colors.text,
    },
    moreChip: {
      backgroundColor: colors.backgroundElement,
      borderRadius: RADIUS.chip,
      paddingHorizontal: SPACING.three,
      paddingVertical: SPACING.two,
    },
    moreChipLabel: {
      ...TYPOGRAPHY.smallBold,
      color: colors.textSecondary,
    },
    settingsCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.card,
      overflow: 'hidden',
    },
    settingsHeader: {
      backgroundColor: colors.backgroundElement,
      paddingHorizontal: SPACING.three,
      paddingVertical: SPACING.two,
    },
    settingsHeaderLabel: {
      ...TYPOGRAPHY.subtitle,
      color: colors.text,
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.three,
      paddingHorizontal: SPACING.three,
      paddingVertical: SPACING.three,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    settingRowLast: {
      borderBottomWidth: 0,
    },
    settingIconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.backgroundElement,
      alignItems: 'center',
      justifyContent: 'center',
    },
    settingText: {
      flex: 1,
      gap: 1,
    },
    settingLabel: {
      ...TYPOGRAPHY.default,
      color: colors.text,
    },
    settingSubtitle: {
      ...TYPOGRAPHY.small,
      color: colors.textSecondary,
    },
    logoutButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.two,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: RADIUS.chip,
      paddingVertical: SPACING.three,
    },
    logoutLabel: {
      ...TYPOGRAPHY.label,
      color: colors.primary,
    },
    version: {
      ...TYPOGRAPHY.small,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: -SPACING.three,
    },
  });
