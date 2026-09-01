import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../styles/theme';
import { getGuestName } from '../utils/guestName';
import useAuthStore from '../state/authStore';
import Logo from '../components/Logo';

const SECTIONS = [
  {
    label: 'Personalize',
    items: [
      { icon: 'heart', label: 'Followed Brands', screen: 'FollowedBrandsScreen' },
      { icon: 'grid', label: 'Favorite Categories', screen: 'FavoriteCategoriesScreen' },
      { icon: 'storefront', label: 'Request a Brand', screen: 'RequestBrandScreen' },
    ],
  },
  {
    label: 'Settings',
    items: [
      { icon: 'notifications', label: 'Notification Preferences', screen: 'NotificationPreferencesScreen' },
      { icon: 'person', label: 'Profile', tab: 'Profile' },
    ],
  },
  {
    label: 'Support',
    items: [
      { icon: 'help-circle', label: 'Help & Support', screen: 'HelpSupportScreen' },
      { icon: 'shield-checkmark', label: 'Privacy Policy', screen: 'PrivacyPolicyScreen' },
      { icon: 'document-text', label: 'Terms & Conditions', screen: 'TermsConditionsScreen' },
    ],
  },
];

const AppDrawerContent = (props) => {
  const insets = useSafeAreaInsets();
  const guestName = useMemo(() => getGuestName(), []);
  const user = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  const goToSignIn = () => {
    props.navigation.closeDrawer();
    props.navigation.navigate('SignInScreen');
  };

  const go = (item) => {
    props.navigation.closeDrawer();
    if (item.tab) {
      props.navigation.navigate('Tabs', { screen: item.tab });
    } else if (item.screen) {
      props.navigation.navigate(item.screen);
    }
  };

  return (
    <View style={styles.root}>
      <DrawerContentScrollView {...props} style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.hero, { paddingTop: insets.top + SPACING.three }]}>
          <View style={styles.glowOuter} />
          <View style={styles.glowInner} />

          <View style={styles.heroTopRow}>
            <Logo light size={24} />
            <View style={styles.heroIconWrap}>
              <Icon name="sparkles" size={14} color="#F5CB1B" style={styles.sparkle} />
              <View style={styles.tagIconCircle}>
                <Icon name="pricetag" size={26} color="#FFFFFF" style={styles.tagIcon} />
              </View>
            </View>
          </View>

          <View style={styles.avatarRow}>
            <View style={styles.avatarRing}>
              <View style={styles.avatar}>
                <Icon name="person" size={20} color="#FFFFFF" />
              </View>
            </View>
            <View>
              <Text style={styles.guestName}>{user ? user.name || user.email : guestName}</Text>
              <Text style={styles.guestSubtitle}>{user ? (user.name ? user.email : 'Signed in') : 'Browsing as a guest'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.linksWrap}>
          {SECTIONS.map((section, sIndex) => (
            <View key={section.label} style={sIndex > 0 && styles.sectionDivider}>
              <Text style={styles.sectionLabel}>{section.label.toUpperCase()}</Text>
              {section.items.map((item) => (
                <Pressable key={item.label} style={styles.row} onPress={() => go(item)}>
                  <View style={styles.rowIconBadge}>
                    <Icon name={item.icon} size={18} color={COLORS.primary} />
                  </View>
                  <Text style={styles.rowLabel}>{item.label}</Text>
                  <Icon name="chevron-forward" size={18} color="#9CA3AF" />
                </Pressable>
              ))}
            </View>
          ))}
        </View>
      </DrawerContentScrollView>

    
    </View>
  );
};

export default AppDrawerContent;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: SPACING.four,
  },
  hero: {
    backgroundColor: '#171717',
    paddingHorizontal: SPACING.four,
    paddingBottom: SPACING.four,
    borderBottomLeftRadius: RADIUS.card,
    borderBottomRightRadius: RADIUS.card,
    borderTopLeftRadius: RADIUS.card,
    borderTopRightRadius: RADIUS.card,
    overflow: 'hidden',
    gap: SPACING.four,
  },
  glowOuter: {
    position: 'absolute',
    top: -80,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(183,19,26,0.35)',
  },
  glowInner: {
    position: 'absolute',
    top: -40,
    right: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(183,19,26,0.45)',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  heroIconWrap: {
    alignItems: 'center',
  },
  sparkle: {
    marginBottom: 2,
    marginLeft: 18,
  },
  tagIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-12deg' }],
  },
  tagIcon: {
    transform: [{ rotate: '12deg' }],
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.three,
  },
  avatarRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestName: {
    ...TYPOGRAPHY.subtitle,
    color: '#FFFFFF',
  },
  guestSubtitle: {
    ...TYPOGRAPHY.small,
    color: 'rgba(255,255,255,0.6)',
  },
  linksWrap: {
    paddingHorizontal: SPACING.four,
    paddingTop: SPACING.four,
  },
  sectionDivider: {
    marginTop: SPACING.three,
    paddingTop: SPACING.three,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  sectionLabel: {
    ...TYPOGRAPHY.label,
    color: COLORS.primary,
    letterSpacing: 1,
    marginBottom: SPACING.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.three,
    paddingVertical: SPACING.two,
  },
  rowIconBadge: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.button,
    backgroundColor: '#FDEEEE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    ...TYPOGRAPHY.smallBold,
    flex: 1,
    color: COLORS.text,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.three,
    marginHorizontal: SPACING.four,
    marginTop: SPACING.three,
    paddingHorizontal: SPACING.three,
    paddingTop: SPACING.three,
    borderWidth: 1,
    borderColor: '#F0DADA',
    borderRadius: RADIUS.card,
    backgroundColor: '#FDEEEE',
  },
  footerIconBadge: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.button,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {
    flex: 1,
    gap: 1,
  },
  footerTitle: {
    ...TYPOGRAPHY.smallBold,
  },
  footerBody: {
    ...TYPOGRAPHY.small,
    color: COLORS.textSecondary,
  },
  signInButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.chip,
    paddingHorizontal: SPACING.four,
    paddingVertical: SPACING.two,
  },
  signInButtonLabel: {
    ...TYPOGRAPHY.smallBold,
    color: '#FFFFFF',
  },
});
