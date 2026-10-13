import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import Screen from '../../components/Screen';
import PrimaryButton from '../../components/PrimaryButton';
import SecondaryButton from '../../components/SecondaryButton';
import { RADIUS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import useTheme from '../../hooks/useTheme';
import useCreateAlertDraftStore from '../../state/createAlertDraftStore';

const AlertCreatedScreen = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const draft = useCreateAlertDraftStore();
  const reset = useCreateAlertDraftStore((s) => s.reset);
  const name = draft.alertType === 'brand' ? draft.brandName : draft.productName;

  return (
    <Screen style={styles.root} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.body}>
        <View style={styles.iconCircle}>
          <Icon name="checkmark" size={40} color={colors.success} />
        </View>
        <Text style={styles.title}>Alert Created</Text>
        <Text style={styles.bodyText}>
          You'll be notified when {name || 'this item'} reaches your selected sale condition.
        </Text>
        <PrimaryButton
          label="View My Alerts"
          onPress={() => {
            reset();
            navigation.reset({
              index: 1,
              routes: [{ name: 'MainTabs' }, { name: 'SaleAlertsScreen' }],
            });
          }}
        />
        <SecondaryButton
          label="Continue Browsing"
          onPress={() => {
            reset();
            navigation.reset({
              index: 0,
              routes: [{ name: 'MainTabs', params: { screen: 'Home' } }],
            });
          }}
        />
      </View>
    </Screen>
  );
};

export default AlertCreatedScreen;

const createStyles = (colors) =>
  StyleSheet.create({
    root: { flex: 1 },
    body: {
      flex: 1,
      padding: SPACING.four,
      justifyContent: 'center',
      gap: SPACING.three,
      alignItems: 'center',
    },
    iconCircle: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: colors.successBg,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.two,
    },
    title: { ...TYPOGRAPHY.headline, color: colors.text },
    bodyText: { ...TYPOGRAPHY.small, color: colors.textSecondary, textAlign: 'center', marginBottom: SPACING.two },
  });
