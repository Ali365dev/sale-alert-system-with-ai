import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { RADIUS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import useTheme from '../../hooks/useTheme';
import useDataStore from '../../state/dataStore';
import usePreferencesStore from '../../state/preferencesStore';
import useAuthStore from '../../state/authStore';
import { deleteAccount } from '../../services/authApi';
import { getGuestName } from '../../utils/guestName';
import { showErrorToast, showSuccessToast } from '../../utils/CustomToast';
import TopAppBar from '../../components/TopAppBar';

const ProfileScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors, isDark, toggleTheme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const brands = useDataStore((state) => state.brands);
  const deals = useDataStore((state) => state.deals);
  const favoriteCategories = usePreferencesStore((state) => state.favoriteCategories);
  const followedBrands = usePreferencesStore((state) => state.followedBrands);
  const guestName = useMemo(() => getGuestName(), []);
  const user = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      "This permanently deletes your account and saved preferences (followed brands, deal preference). This can't be undone. Favorites and offers you've browsed as a guest on this device aren't affected.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            const result = await deleteAccount();
            setDeleting(false);
            if (result.ok) {
              clearAuth();
              showSuccessToast('Your account has been deleted.');
            } else {
              showErrorToast(result.error);
            }
          },
        },
      ],
    );
  };

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
      icon: 'options-outline',
      label: 'Deal Preference',
      subtitle: favoriteCategories.length
        ? `${favoriteCategories.length} interest${favoriteCategories.length === 1 ? '' : 's'} selected`
        : 'Pick at least 5 interests',
      kind: 'link',
      onPress: () => navigation.navigate('DealPreferenceScreen'),
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
      <TopAppBar title="Profile" hideProfile hideBorder />
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
          <Text style={styles.accountTitle}>{user ? user.name || user.email : guestName}</Text>
          <Text style={styles.accountSubtitle}>{user ? (user.name ? user.email : 'Signed in') : 'Browsing as a guest'}</Text>
          <View style={styles.premiumPill}>
            <Icon name="pricetags-outline" size={13} color={colors.text} />
            <Text style={styles.premiumPillLabel}>{deals.length} offers tracked</Text>
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

        {user ? (
          <>
            <Pressable style={styles.logoutButton} onPress={clearAuth}>
              <Icon name="log-out-outline" size={18} color={colors.primary} />
              <Text style={styles.logoutLabel}>Log Out</Text>
            </Pressable>
            <Pressable style={styles.deleteAccountButton} onPress={handleDeleteAccount} disabled={deleting}>
              <Icon name="trash-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.deleteAccountLabel}>{deleting ? 'Deleting…' : 'Delete Account'}</Text>
            </Pressable>
          </>
        ) : (
          <Pressable style={styles.logoutButton} onPress={() => navigation.navigate('SignInScreen')}>
            <Icon name="log-in-outline" size={18} color={colors.primary} />
            <Text style={styles.logoutLabel}>Sign In / Create Account</Text>
          </Pressable>
        )}

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
      paddingTop: SPACING.three,
      gap: SPACING.four,
    },
    avatarCard: {
      alignItems: 'center',
      gap: SPACING.two,
      backgroundColor: colors.surface,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: colors.border,
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
    deleteAccountButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.two,
      paddingVertical: SPACING.three,
      marginTop: -SPACING.two,
    },
    deleteAccountLabel: {
      ...TYPOGRAPHY.small,
      color: colors.textSecondary,
    },
    version: {
      ...TYPOGRAPHY.small,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: -SPACING.three,
    },
  });
