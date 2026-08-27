import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../../styles/theme';

const FAQS = [
  {
    question: 'How do I follow a brand or category?',
    answer:
      "Go to Profile → Followed Brands or Favorite Categories to pick what you're interested in. You can also choose them during onboarding, and your \"For You\" feed on Home updates automatically.",
  },
  {
    question: "Why am I not getting notified about a brand's deals?",
    answer:
      'Make sure the brand is added under Profile → Followed Brands, and that notifications are allowed for DealPulse in your phone settings.',
  },
  {
    question: 'Are the discounts and coupon codes verified?',
    answer:
      'Offers go through an automated verification pass, shown as a status on each deal. Always confirm the final price and code at checkout, since brands can end promotions at any time.',
  },
  {
    question: 'Do I need an account to use DealPulse?',
    answer: 'No — you can use DealPulse as a guest. Your preferences are saved to your device automatically.',
  },
];

function FaqItem({ question, answer, expanded, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.faqItem}>
      <View style={styles.faqHeader}>
        <Text style={styles.faqQuestion}>{question}</Text>
        <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color="#6B7280" />
      </View>
      {expanded && <Text style={styles.faqAnswer}>{answer}</Text>}
    </Pressable>
  );
}

const HelpSupportScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [openIndex, setOpenIndex] = useState(null);

  const toggle = (i) => setOpenIndex((prev) => (prev === i ? null : i));

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + SPACING.three }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Icon name="chevron-back" size={24} color="#171717" />
        </Pressable>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.six }]} showsVerticalScrollIndicator={false}>
        <View style={styles.contactCard}>
          <Text style={styles.contactTitle}>Need more help?</Text>
          <Text style={styles.contactBody}>Our team usually replies within a day.</Text>
          <Pressable style={styles.contactRow} onPress={() => Linking.openURL('mailto:support@dealpulse.app')}>
            <View style={styles.contactIconCircle}>
              <Icon name="mail-outline" size={18} color={COLORS.primary} />
            </View>
            <View style={styles.contactText}>
              <Text style={styles.contactLabel}>Email Support</Text>
              <Text style={styles.contactValue}>support@dealpulse.app</Text>
            </View>
            <Icon name="chevron-forward" size={18} color="#6B7280" />
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          <View style={styles.faqCard}>
            {FAQS.map((faq, i) => (
              <View key={faq.question} style={[styles.faqWrap, i === FAQS.length - 1 && styles.faqWrapLast]}>
                <FaqItem question={faq.question} answer={faq.answer} expanded={openIndex === i} onPress={() => toggle(i)} />
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default HelpSupportScreen;

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
    gap: SPACING.five,
  },
  contactCard: {
    backgroundColor: '#FDEEEE',
    borderRadius: RADIUS.card,
    padding: SPACING.four,
    gap: SPACING.one,
  },
  contactTitle: {
    ...TYPOGRAPHY.headline,
  },
  contactBody: {
    ...TYPOGRAPHY.small,
    color: COLORS.textSecondary,
    marginBottom: SPACING.two,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.three,
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.button,
    padding: SPACING.three,
  },
  contactIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactText: {
    flex: 1,
    gap: 1,
  },
  contactLabel: {
    ...TYPOGRAPHY.default,
  },
  contactValue: {
    ...TYPOGRAPHY.small,
    color: COLORS.textSecondary,
  },
  section: {
    gap: SPACING.three,
  },
  sectionTitle: {
    ...TYPOGRAPHY.headline,
  },
  faqCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.card,
    overflow: 'hidden',
  },
  faqWrap: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  faqWrapLast: {
    borderBottomWidth: 0,
  },
  faqItem: {
    padding: SPACING.three,
    gap: SPACING.two,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.two,
  },
  faqQuestion: {
    ...TYPOGRAPHY.smallBold,
    flex: 1,
  },
  faqAnswer: {
    ...TYPOGRAPHY.small,
    color: COLORS.textSecondary,
  },
});
