import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Screen from '../../components/Screen';
import TopAppBar from '../../components/TopAppBar';
import PrimaryButton from '../../components/PrimaryButton';
import OnboardingProgress from '../../components/OnboardingProgress';
import { RADIUS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import useTheme from '../../hooks/useTheme';
import useCreateAlertDraftStore from '../../state/createAlertDraftStore';

const Field = ({ label, required, styles, ...props }) => (
  <View style={styles.field}>
    <Text style={styles.label}>
      {label}
      {required ? ' *' : ''}
    </Text>
    <TextInput style={styles.input} placeholderTextColor={styles.placeholder.color} {...props} />
  </View>
);

const ManualProductScreen = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const draft = useCreateAlertDraftStore();
  const setProductFields = useCreateAlertDraftStore((s) => s.setProductFields);

  const [productName, setProductName] = useState(draft.productName || '');
  const [brandName, setBrandName] = useState(draft.brandName || '');
  const [productUrl, setProductUrl] = useState(draft.productUrl || '');
  const [currentPrice, setCurrentPrice] = useState(draft.currentPrice != null ? String(draft.currentPrice) : '');
  const [originalPrice, setOriginalPrice] = useState(draft.originalPrice != null ? String(draft.originalPrice) : '');
  const [imageUrl, setImageUrl] = useState(draft.imageUrl || '');
  const [sku, setSku] = useState(draft.sku || '');
  const [variant, setVariant] = useState(draft.variant || '');

  const canContinue = productName.trim() && brandName.trim() && productUrl.trim();

  const onContinue = () => {
    setProductFields({
      productName: productName.trim(),
      brandName: brandName.trim(),
      productUrl: productUrl.trim(),
      currentPrice: currentPrice ? Number(currentPrice) : null,
      originalPrice: originalPrice ? Number(originalPrice) : null,
      imageUrl: imageUrl.trim(),
      sku: sku.trim(),
      variant: variant.trim(),
      analyzeFailed: false,
    });
    navigation.navigate('AlertConditionsScreen');
  };

  return (
    <Screen style={styles.root}>
      <TopAppBar title="Product Details" showBack hideProfile />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <OnboardingProgress step={1} total={5} />
        <Text style={styles.heading}>Product Details</Text>
        <Text style={styles.sub}>Fields we already found are filled in — complete anything missing.</Text>

        <Field styles={styles} label="Product Name" required value={productName} onChangeText={setProductName} />
        <Field styles={styles} label="Brand" required value={brandName} onChangeText={setBrandName} />
        <Field
          styles={styles}
          label="Product URL"
          required
          value={productUrl}
          onChangeText={setProductUrl}
          autoCapitalize="none"
          keyboardType="url"
        />
        <Field
          styles={styles}
          label="Current Price"
          value={currentPrice}
          onChangeText={setCurrentPrice}
          keyboardType="decimal-pad"
          placeholder="120"
        />
        <Field
          styles={styles}
          label="Original Price"
          value={originalPrice}
          onChangeText={setOriginalPrice}
          keyboardType="decimal-pad"
          placeholder="150"
        />
        <Field
          styles={styles}
          label="Product Image URL"
          value={imageUrl}
          onChangeText={setImageUrl}
          autoCapitalize="none"
        />
        <Field styles={styles} label="SKU / Product ID" value={sku} onChangeText={setSku} />
        <Field styles={styles} label="Product Variant" value={variant} onChangeText={setVariant} />

        <PrimaryButton label="Continue" onPress={onContinue} disabled={!canContinue} style={{ marginTop: SPACING.two }} />
      </ScrollView>
    </Screen>
  );
};

export default ManualProductScreen;

const createStyles = (colors) =>
  StyleSheet.create({
    root: { flex: 1 },
    body: { padding: SPACING.four, gap: SPACING.three, paddingBottom: SPACING.six },
    heading: { ...TYPOGRAPHY.headline, color: colors.text, marginTop: SPACING.two },
    sub: { ...TYPOGRAPHY.small, color: colors.textSecondary },
    field: { gap: SPACING.one },
    label: { ...TYPOGRAPHY.label, color: colors.text },
    input: {
      ...TYPOGRAPHY.default,
      color: colors.text,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.button,
      paddingHorizontal: SPACING.three,
      paddingVertical: SPACING.three,
    },
    placeholder: { color: colors.mutedInk },
  });
