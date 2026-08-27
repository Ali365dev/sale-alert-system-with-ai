import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import PrimaryButton from '../../components/PrimaryButton';

function PolicySection({ icon, title, children }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Icon name={icon} size={18} color={COLORS.primary} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function BulletRow({ icon, title, body }) {
  return (
    <View style={styles.bulletRow}>
      <Icon name={icon} size={18} color="#6B7280" style={styles.bulletIcon} />
      <View style={styles.bulletText}>
        <Text style={styles.bulletTitle}>{title}</Text>
        <Text style={styles.bulletBody}>{body}</Text>
      </View>
    </View>
  );
}

function UsageTile({ title, body }) {
  return (
    <View style={styles.usageTile}>
      <Text style={styles.usageTitle}>{title}</Text>
      <Text style={styles.usageBody}>{body}</Text>
    </View>
  );
}

const PrivacyPolicyScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + SPACING.three }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Icon name="chevron-back" size={24} color="#171717" />
        </Pressable>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.six }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.updated}>LAST UPDATED: OCTOBER 2023</Text>
        <Text style={styles.intro}>
          At DealPulse, we take your privacy seriously. This policy outlines exactly what information we collect, how it's
          utilized to improve your deal-finding experience, and the steps we take to ensure your data remains secure within
          our ecosystem.
        </Text>

        <PolicySection icon="server-outline" title="Data Collection">
          <Text style={styles.sectionBody}>We collect data necessary to provide and improve the DealPulse service.</Text>
          <BulletRow icon="person-outline" title="Account Information" body="Name, email address, and saved preferences." />
          <BulletRow icon="time-outline" title="Browsing Activity" body="Categories viewed, deals clicked, and search queries within the app." />
        </PolicySection>

        <PolicySection icon="options-outline" title="How We Use Your Data">
          <Text style={styles.sectionBody}>Your data fuels the engine that finds the best deals tailored specifically for you.</Text>
          <View style={styles.usageGrid}>
            <UsageTile title="Personalization" body="To curate deals based on your followed brands and categories." />
            <UsageTile title="Service Improvement" body="Analyzing aggregated usage patterns to refine our search algorithms." />
            <UsageTile title="Communication" body="Sending critical alerts regarding saved deals or account security." />
          </View>
        </PolicySection>

        <PolicySection icon="people-outline" title="Third-Party Sharing">
          <Text style={styles.sectionBody}>
            We strictly limit third-party sharing. We <Text style={styles.bold}>do not</Text> sell your personal data to
            advertisers.
          </Text>
          <Text style={styles.sectionBody}>
            Information may be shared only with essential service providers (e.g., secure payment processors, cloud
            hosting) who are contractually bound to safeguard your data under similarly strict privacy standards.
          </Text>
        </PolicySection>

        <View style={styles.acknowledgeWrap}>
          <PrimaryButton label="Acknowledge" pill onPress={() => navigation.goBack()} />
        </View>
      </ScrollView>
    </View>
  );
};

export default PrivacyPolicyScreen;

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
    gap: SPACING.four,
  },
  updated: {
    ...TYPOGRAPHY.label,
    color: COLORS.textSecondary,
    letterSpacing: 1,
  },
  intro: {
    ...TYPOGRAPHY.default,
    color: COLORS.textSecondary,
    marginTop: -SPACING.two,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.card,
    padding: SPACING.three,
    gap: SPACING.three,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.two,
    paddingBottom: SPACING.two,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sectionTitle: {
    ...TYPOGRAPHY.subtitle,
  },
  sectionBody: {
    ...TYPOGRAPHY.small,
    color: COLORS.textSecondary,
  },
  bold: {
    fontWeight: '700',
    color: COLORS.text,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.two,
  },
  bulletIcon: {
    marginTop: 2,
  },
  bulletText: {
    flex: 1,
    gap: 2,
  },
  bulletTitle: {
    ...TYPOGRAPHY.smallBold,
  },
  bulletBody: {
    ...TYPOGRAPHY.small,
    color: COLORS.textSecondary,
  },
  usageGrid: {
    gap: SPACING.two,
  },
  usageTile: {
    backgroundColor: '#F8F9FB',
    borderRadius: RADIUS.button,
    padding: SPACING.three,
    gap: 4,
  },
  usageTitle: {
    ...TYPOGRAPHY.smallBold,
  },
  usageBody: {
    ...TYPOGRAPHY.small,
    color: COLORS.textSecondary,
  },
  acknowledgeWrap: {
    alignItems: 'center',
    paddingTop: SPACING.two,
  },
});
