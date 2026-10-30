import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import Screen from '../../components/Screen';
import TopAppBar from '../../components/TopAppBar';
import PrimaryButton from '../../components/PrimaryButton';
import OnboardingProgress from '../../components/OnboardingProgress';
import { RADIUS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import useTheme from '../../hooks/useTheme';
import useCreateAlertDraftStore from '../../state/createAlertDraftStore';
import {
  currentDiscountPct,
  isPctConditionAvailable,
  validateAlertConditions,
} from '../../utils/saleAlertValidation';
import { showErrorToast } from '../../utils/CustomToast';

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

  const livePct = useMemo(() => {
    if (draft.alertType !== 'product') return null;
    if (draft.discountPct != null && Number.isFinite(Number(draft.discountPct))) {
      return Number(draft.discountPct);
    }
    return currentDiscountPct(draft.currentPrice, draft.originalPrice);
  }, [draft.alertType, draft.discountPct, draft.currentPrice, draft.originalPrice]);

  const alreadyOnSale = draft.alertType === 'product' && livePct != null && livePct > 0;
  const minCustomPct = alreadyOnSale ? Math.min(99, Math.floor(livePct) + 1) : 1;

  const options = useMemo(() => {
    const base = draft.alertType === 'brand' ? BRAND_OPTIONS : PRODUCT_OPTIONS;
    if (draft.alertType !== 'product' || !alreadyOnSale) return base;
    return base.filter((opt) => isPctConditionAvailable(opt.id, livePct));
  }, [draft.alertType, alreadyOnSale, livePct]);

  const defaultCustom = String(Math.max(25, minCustomPct));
  const [conditionType, setConditionType] = useState(() => {
    const preferred = draft.conditionType || 'any_sale';
    if (draft.alertType === 'product' && alreadyOnSale && !isPctConditionAvailable(preferred, livePct)) {
      return 'custom_pct';
    }
    return preferred;
  });
  const [customPct, setCustomPct] = useState(() => {
    const fromDraft = draft.customPct != null ? Number(draft.customPct) : NaN;
    if (Number.isFinite(fromDraft) && fromDraft >= minCustomPct) return String(fromDraft);
    return defaultCustom;
  });
  const [targetPrice, setTargetPrice] = useState(draft.targetPrice != null ? String(draft.targetPrice) : '');
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!options.some((o) => o.id === conditionType)) {
      setConditionType(options[0]?.id || 'custom_pct');
    }
  }, [options, conditionType]);

  const onSelect = (id) => {
    setConditionType(id);
    setErrors({});
    if (id === 'custom_pct') {
      const n = Number(customPct);
      if (!Number.isFinite(n) || n < minCustomPct) setCustomPct(String(minCustomPct));
    }
  };

  const onContinue = () => {
    const result = validateAlertConditions({
      alertType: draft.alertType,
      conditionType,
      customPct,
      targetPrice,
      currentPrice: draft.currentPrice,
      originalPrice: draft.originalPrice,
      alreadyOnSale,
    });
    if (!result.ok) {
      setErrors(result.errors || {});
      Alert.alert('Condition unavailable', result.error, [{ text: 'OK' }]);
      showErrorToast(result.error);
      return;
    }
    setErrors({});
    setField('conditionType', result.values.conditionType);
    setField('customPct', result.values.customPct ?? Math.max(25, minCustomPct));
    setField('targetPrice', result.values.targetPrice);
    navigation.navigate('AlertNotificationsScreen');
  };

  return (
    <Screen style={styles.root}>
      <TopAppBar title="Alert Conditions" showBack hideProfile />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <OnboardingProgress step={2} total={5} />
        <Text style={styles.heading}>Set your alert condition</Text>
        <Text style={styles.sub}>Choose when you would like to be notified about this product.</Text>

        {alreadyOnSale ? (
          <View style={styles.saleBanner}>
            <Text style={styles.saleBannerTitle}>
              Current discount: {Math.round(livePct)}%
            </Text>
            <Text style={styles.saleBannerBody}>
              This item is already discounted. Select a threshold above{' '}
              {Math.round(livePct)}% so we only notify you when the offer improves.
            </Text>
          </View>
        ) : null}

        {options.map((opt) => {
          const selected = conditionType === opt.id;
          return (
            <Pressable key={opt.id} style={[styles.row, selected && styles.rowSelected]} onPress={() => onSelect(opt.id)}>
              <Icon name={selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={selected ? colors.primary : colors.textSecondary} />
              <Text style={[styles.rowLabel, selected && styles.rowLabelSelected]}>{opt.label}</Text>
            </Pressable>
          );
        })}

        {conditionType === 'custom_pct' && (
          <View style={styles.inlineBlock}>
            <View style={styles.inline}>
              <Text style={styles.inlineLabel}>Alert when discount reaches</Text>
              <TextInput
                style={[styles.inlineInput, errors.customPct ? styles.inputError : null]}
                value={customPct}
                onChangeText={(t) => {
                  setCustomPct(t);
                  if (errors.customPct) setErrors({});
                }}
                keyboardType="number-pad"
                placeholder={String(minCustomPct)}
                placeholderTextColor={colors.mutedInk}
              />
              <Text style={styles.inlineLabel}>%</Text>
            </View>
            {alreadyOnSale ? (
              <Text style={styles.hint}>
                Enter a value above {Math.round(livePct)}% to continue.
              </Text>
            ) : null}
            {errors.customPct ? <Text style={styles.errorText}>{errors.customPct}</Text> : null}
          </View>
        )}

        {conditionType === 'target_price' && (
          <View style={styles.inlineBlock}>
            <View style={styles.inline}>
              <Text style={styles.inlineLabel}>Alert when price drops below Rs.</Text>
              <TextInput
                style={[styles.inlineInput, errors.targetPrice ? styles.inputError : null]}
                value={targetPrice}
                onChangeText={(t) => {
                  setTargetPrice(t);
                  if (errors.targetPrice) setErrors({});
                }}
                keyboardType="decimal-pad"
                placeholder="3000"
                placeholderTextColor={colors.mutedInk}
              />
            </View>
            {alreadyOnSale && draft.currentPrice != null ? (
              <Text style={styles.hint}>
                Enter an amount below Rs.{' '}
                {Math.round(Number(draft.currentPrice)).toLocaleString('en-PK')}.
              </Text>
            ) : null}
            {errors.targetPrice ? <Text style={styles.errorText}>{errors.targetPrice}</Text> : null}
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
    saleBanner: {
      backgroundColor: colors.primarySoft,
      borderRadius: RADIUS.button,
      padding: SPACING.three,
      gap: 4,
      marginBottom: SPACING.one,
    },
    saleBannerTitle: { ...TYPOGRAPHY.smallBold, color: colors.primary },
    saleBannerBody: { ...TYPOGRAPHY.small, color: colors.textSecondary, lineHeight: 18 },
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
    inlineBlock: { gap: SPACING.one, marginTop: SPACING.two },
    inline: { flexDirection: 'row', alignItems: 'center', gap: SPACING.two, flexWrap: 'wrap' },
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
    inputError: { borderColor: colors.error },
    errorText: { ...TYPOGRAPHY.small, color: colors.error },
    hint: { ...TYPOGRAPHY.small, color: colors.textSecondary },
  });
