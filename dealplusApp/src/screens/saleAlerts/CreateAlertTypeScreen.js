import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import Screen from '../../components/Screen';
import TopAppBar from '../../components/TopAppBar';
import OnboardingProgress from '../../components/OnboardingProgress';
import { RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import useTheme from '../../hooks/useTheme';
import useCreateAlertDraftStore from '../../state/createAlertDraftStore';

const CreateAlertTypeScreen = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const setField = useCreateAlertDraftStore((s) => s.setField);

  const pick = (type) => {
    setField('alertType', type);
    if (type === 'product') navigation.navigate('AddProductUrlScreen');
    else navigation.navigate('SelectBrandForAlertScreen');
  };

  return (
    <Screen style={styles.root}>
      <TopAppBar title="Create Alert" showBack hideProfile />
      <View style={styles.body}>
        <OnboardingProgress step={0} total={5} />
        <Text style={styles.heading}>What do you want to track?</Text>
        <Text style={styles.sub}>Choose a product or a brand to watch for sales.</Text>

        <Pressable style={styles.card} onPress={() => pick('product')}>
          <View style={styles.iconCircle}>
            <Icon name="cube-outline" size={26} color={colors.primary} />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Track a Product</Text>
            <Text style={styles.cardBody}>Get notified when a specific product goes on sale.</Text>
          </View>
          <Icon name="chevron-forward" size={20} color={colors.textSecondary} />
        </Pressable>

        <Pressable style={styles.card} onPress={() => pick('brand')}>
          <View style={styles.iconCircle}>
            <Icon name="storefront-outline" size={26} color={colors.primary} />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Track a Brand</Text>
            <Text style={styles.cardBody}>Get notified whenever this brand has a sale or promotion.</Text>
          </View>
          <Icon name="chevron-forward" size={20} color={colors.textSecondary} />
        </Pressable>
      </View>
    </Screen>
  );
};

export default CreateAlertTypeScreen;

const createStyles = (colors) =>
  StyleSheet.create({
    root: { flex: 1 },
    body: { padding: SPACING.four, gap: SPACING.three },
    heading: { ...TYPOGRAPHY.headline, color: colors.text, marginTop: SPACING.two },
    sub: { ...TYPOGRAPHY.small, color: colors.textSecondary },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.three,
      backgroundColor: colors.surface,
      borderRadius: RADIUS.card,
      padding: SPACING.three,
      borderWidth: 1,
      borderColor: colors.border,
      ...SHADOWS.card,
    },
    iconCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardText: { flex: 1, gap: 4 },
    cardTitle: { ...TYPOGRAPHY.subtitle, fontSize: 16, color: colors.text },
    cardBody: { ...TYPOGRAPHY.small, color: colors.textSecondary },
  });
