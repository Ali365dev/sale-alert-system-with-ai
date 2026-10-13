import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import Screen from '../../components/Screen';
import TopAppBar from '../../components/TopAppBar';
import PrimaryButton from '../../components/PrimaryButton';
import OnboardingProgress from '../../components/OnboardingProgress';
import { RADIUS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import useTheme from '../../hooks/useTheme';
import useCreateAlertDraftStore from '../../state/createAlertDraftStore';

const PRODUCT_OPTIONS = [
  { id: 'any_sale', label: 'Any sale' },
  { id: 'pct_10', label: '10% or more off' },
  { id: 'pct_20', label: '20% or more off' },
  { id: 'pct_30', label: '30% or more off' },
  { id: 'custom_pct', label: 'Custom discount' },
  { id: 'target_price', label: 'Price drops below a specific amount' },
];

const BRAND_OPTIONS = [
  { id: 'any_sale', label: 'Any sale' },
  { id: 'pct_10', label: 'Discount ≥ 10%' },
  { id: 'pct_20', label: 'Discount ≥ 20%' },
  { id: 'pct_30', label: 'Discount ≥ 30%' },
  { id: 'new_promotion', label: 'New promotion' },
  { id: 'new_code', label: 'New discount code' },
];

const AlertConditionsScreen = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const draft = useCreateAlertDraftStore();
  const setField = useCreateAlertDraftStore((s) => s.setField);
  const [conditionType, setConditionType] = useState(draft.conditionType || 'any_sale');
  const [customPct, setCustomPct] = useState(String(draft.customPct ?? 25));
  const [targetPrice, setTargetPrice] = useState(draft.targetPrice != null ? String(draft.targetPrice) : '');

  const options = draft.alertType === 'brand' ? BRAND_OPTIONS : PRODUCT_OPTIONS;

  const onContinue = () => {
    setField('conditionType', conditionType);
    setField('customPct', customPct ? Number(customPct) : 25);
    setField('targetPrice', targetPrice ? Number(targetPrice) : null);
    navigation.navigate('AlertNotificationsScreen');
  };

  return (
    <Screen style={styles.root}>
      <TopAppBar title="Alert Conditions" showBack hideProfile />
      <ScrollView contentContainerStyle={styles.body}>
        <OnboardingProgress step={2} total={5} />
        <Text style={styles.heading}>When should we alert you?</Text>
        <Text style={styles.sub}>Pick the sale condition that matters most.</Text>

        {options.map((opt) => {
          const selected = conditionType === opt.id;
          return (
            <Pressable key={opt.id} style={[styles.row, selected && styles.rowSelected]} onPress={() => setConditionType(opt.id)}>
              <Icon name={selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={selected ? colors.primary : colors.textSecondary} />
              <Text style={[styles.rowLabel, selected && styles.rowLabelSelected]}>{opt.label}</Text>
            </Pressable>
          );
        })}

        {conditionType === 'custom_pct' && (
          <View style={styles.inline}>
            <Text style={styles.inlineLabel}>Alert when discount reaches</Text>
            <TextInput
              style={styles.inlineInput}
              value={customPct}
              onChangeText={setCustomPct}
              keyboardType="number-pad"
              placeholder="25"
              placeholderTextColor={colors.mutedInk}
            />
            <Text style={styles.inlineLabel}>%</Text>
          </View>
        )}

        {conditionType === 'target_price' && (
          <View style={styles.inline}>
            <Text style={styles.inlineLabel}>Alert when price drops below $</Text>
            <TextInput
              style={styles.inlineInput}
              value={targetPrice}
              onChangeText={setTargetPrice}
              keyboardType="decimal-pad"
              placeholder="100"
              placeholderTextColor={colors.mutedInk}
            />
          </View>
        )}

        <PrimaryButton label="Continue" onPress={onContinue} style={{ marginTop: SPACING.two }} />
      </ScrollView>
    </Screen>
  );
};

export default AlertConditionsScreen;

const createStyles = (colors) =>
  StyleSheet.create({
    root: { flex: 1 },
    body: { padding: SPACING.four, gap: SPACING.two, paddingBottom: SPACING.six },
    heading: { ...TYPOGRAPHY.headline, color: colors.text, marginTop: SPACING.two },
    sub: { ...TYPOGRAPHY.small, color: colors.textSecondary, marginBottom: SPACING.two },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.two,
      padding: SPACING.three,
      borderRadius: RADIUS.button,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    rowSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    rowLabel: { ...TYPOGRAPHY.default, color: colors.text, flex: 1 },
    rowLabelSelected: { fontWeight: '700' },
    inline: { flexDirection: 'row', alignItems: 'center', gap: SPACING.two, flexWrap: 'wrap', marginTop: SPACING.two },
    inlineLabel: { ...TYPOGRAPHY.small, color: colors.text },
    inlineInput: {
      ...TYPOGRAPHY.default,
      minWidth: 72,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.button,
      paddingHorizontal: SPACING.two,
      paddingVertical: SPACING.two,
      backgroundColor: colors.surface,
    },
  });
