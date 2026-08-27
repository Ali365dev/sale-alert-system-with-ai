import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import useNotificationPrefsStore from '../../state/notificationPrefsStore';

const TOGGLE_ROWS = [
  {
    key: 'newDealsFromFollowedBrands',
    icon: 'pricetags-outline',
    label: 'New Deals from Followed Brands',
    subtitle: 'Get notified when a brand you follow drops a new offer',
  },
  {
    key: 'priceDropAlerts',
    icon: 'trending-down-outline',
    label: 'Price Drop Alerts',
    subtitle: 'When a saved deal gets an even bigger discount',
  },
  {
    key: 'expiringSoonReminders',
    icon: 'time-outline',
    label: 'Expiring Soon Reminders',
    subtitle: "Before a deal you've viewed is about to expire",
  },
  {
    key: 'weeklyDigest',
    icon: 'newspaper-outline',
    label: 'Weekly Digest',
    subtitle: 'A weekly summary of the best deals for you',
  },
];

const NotificationPreferencesScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const prefs = useNotificationPrefsStore();
  const setPref = useNotificationPrefsStore((state) => state.setPref);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + SPACING.three }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Icon name="chevron-back" size={24} color="#171717" />
        </Pressable>
        <Text style={styles.headerTitle}>Notification Preferences</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.six }]} showsVerticalScrollIndicator={false}>
        <View style={styles.masterCard}>
          <View style={styles.masterRow}>
            <View style={styles.masterIconCircle}>
              <Icon name="notifications" size={20} color="#FFFFFF" />
            </View>
            <View style={styles.masterText}>
              <Text style={styles.masterLabel}>Push Notifications</Text>
              <Text style={styles.masterSubtitle}>Turn all alerts on or off</Text>
            </View>
            <Switch
              value={prefs.pushEnabled}
              onValueChange={(v) => setPref('pushEnabled', v)}
              trackColor={{ false: '#E5E7EB', true: '#FFFFFF' }}
              thumbColor={prefs.pushEnabled ? COLORS.primary : undefined}
            />
          </View>
        </View>

        <Text style={styles.sectionLabel}>ALERT TYPES</Text>
        <View style={[styles.rowsCard, !prefs.pushEnabled && styles.rowsCardDisabled]}>
          {TOGGLE_ROWS.map((row, i) => (
            <View key={row.key} style={[styles.settingRow, i === TOGGLE_ROWS.length - 1 && styles.settingRowLast]}>
              <View style={styles.settingIconCircle}>
                <Icon name={row.icon} size={18} color="#171717" />
              </View>
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>{row.label}</Text>
                <Text style={styles.settingSubtitle}>{row.subtitle}</Text>
              </View>
              <Switch
                disabled={!prefs.pushEnabled}
                value={prefs[row.key]}
                onValueChange={(v) => setPref(row.key, v)}
                trackColor={{ false: '#E5E7EB', true: COLORS.primary }}
              />
            </View>
          ))}
        </View>

        <Text style={styles.footNote}>
          These control which alerts you receive on this device. You can still browse and follow brands or categories
          even with push notifications off.
        </Text>
      </ScrollView>
    </View>
  );
};

export default NotificationPreferencesScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.four,
    paddingBottom: SPACING.two,
  },
  headerTitle: {
    ...TYPOGRAPHY.subtitle,
  },
  headerSpacer: {
    width: 24,
  },
  content: {
    paddingHorizontal: SPACING.four,
    paddingTop: SPACING.three,
    gap: SPACING.three,
  },
  masterCard: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.card,
    padding: SPACING.three,
  },
  masterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.three,
  },
  masterIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  masterText: {
    flex: 1,
    gap: 1,
  },
  masterLabel: {
    ...TYPOGRAPHY.smallBold,
    color: '#FFFFFF',
    fontSize: 15,
  },
  masterSubtitle: {
    ...TYPOGRAPHY.small,
    color: 'rgba(255,255,255,0.85)',
  },
  sectionLabel: {
    ...TYPOGRAPHY.label,
    color: COLORS.textSecondary,
    letterSpacing: 1,
    marginTop: SPACING.two,
  },
  rowsCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.card,
    overflow: 'hidden',
  },
  rowsCardDisabled: {
    opacity: 0.5,
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
  footNote: {
    ...TYPOGRAPHY.small,
    color: COLORS.textSecondary,
    marginTop: SPACING.one,
  },
});
