import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { SPACING, TYPOGRAPHY } from '../../styles/theme';
import useTheme from '../../hooks/useTheme';

const SECTIONS = [
  {
    title: '1. User Agreement',
    paragraphs: [
      'By accessing or using the DealPulse platform, you agree to be bound by these Terms and Conditions. If you disagree with any part of the terms, you may not access the service. DealPulse provides a curated platform for high-intent shoppers to discover and engage with exclusive deals.',
      'You must be at least 18 years of age to use this service. By using DealPulse, you represent and warrant that you meet this age requirement.',
    ],
  },
  {
    title: '2. Intellectual Property',
    paragraphs: [
      'The service and its original content, features, and functionality are and will remain the exclusive property of DealPulse and its licensors. The service is protected by copyright, trademark, and other laws of both the United States and foreign countries.',
      'Our trademarks and trade dress may not be used in connection with any product or service without the prior written consent of DealPulse.',
    ],
  },
  {
    title: '3. Limitation of Liability',
    paragraphs: [
      'In no event shall DealPulse, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the service.',
    ],
  },
  {
    title: '4. Governing Law',
    paragraphs: [
      'These Terms shall be governed and construed in accordance with the laws of the State of California, United States, without regard to its conflict of law provisions.',
      'Our failure to enforce any right or provision of these Terms will not be considered a waiver of those rights. If any provision of these Terms is held to be invalid or unenforceable by a court, the remaining provisions of these Terms will remain in effect.',
    ],
  },
];

const TermsConditionsScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + SPACING.three }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Icon name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Terms & Conditions</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.six }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.updated}>Last updated: October 24, 2023</Text>

        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.paragraphs.map((p, i) => (
              <Text key={i} style={styles.paragraph}>
                {p}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

export default TermsConditionsScreen;

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
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
      color: colors.text,
    },
    headerSpacer: {
      width: 24,
    },
    content: {
      paddingHorizontal: SPACING.four,
      paddingTop: SPACING.three,
      gap: SPACING.five,
    },
    updated: {
      ...TYPOGRAPHY.small,
      color: colors.textSecondary,
      marginTop: -SPACING.two,
    },
    section: {
      gap: SPACING.two,
    },
    sectionTitle: {
      ...TYPOGRAPHY.subtitle,
      color: colors.text,
      paddingBottom: SPACING.two,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    paragraph: {
      ...TYPOGRAPHY.default,
      color: colors.textSecondary,
    },
  });
