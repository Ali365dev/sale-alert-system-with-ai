import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Screen from '../../components/Screen';
import TopAppBar from '../../components/TopAppBar';
import PrimaryButton from '../../components/PrimaryButton';
import OnboardingProgress from '../../components/OnboardingProgress';
import ProductImage, { normalizeProductImageUrl } from '../../components/ProductImage';
import { RADIUS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import useTheme from '../../hooks/useTheme';
import useCreateAlertDraftStore from '../../state/createAlertDraftStore';
import { validateManualProduct } from '../../utils/saleAlertValidation';
import { showErrorToast } from '../../utils/CustomToast';

const Field = ({ label, required, styles, error, ...props }) => (
  <View style={styles.field}>
    <Text style={styles.label}>
      {label}
      {required ? ' *' : ''}
    </Text>
    <TextInput
      style={[styles.input, error ? styles.inputError : null]}
      placeholderTextColor={styles.placeholder.color}
      {...props}
    />
    {error ? <Text style={styles.errorText}>{error}</Text> : null}
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
  const [errors, setErrors] = useState({});

  const clearError = (key) => {
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const onContinue = () => {
    const result = validateManualProduct({
      productName,
      brandName,
      productUrl,
      currentPrice,
      originalPrice,
      imageUrl,
    });
    if (!result.ok) {
      setErrors(result.errors || {});
      showErrorToast(result.error);
      return;
    }
    setErrors({});
    setProductFields({
      productName: result.values.productName,
      brandName: result.values.brandName,
      productUrl: result.values.productUrl,
      currentPrice: result.values.currentPrice,
      originalPrice: result.values.originalPrice,
      imageUrl: normalizeProductImageUrl(result.values.imageUrl) || result.values.imageUrl,
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
        <Text style={styles.sub}>
          Available details have been pre-filled. Please complete any missing fields.
        </Text>

        <View style={styles.preview}>
          <ProductImage uri={imageUrl} size={112} />
        </View>

        <Field
          styles={styles}
          label="Product Name"
          required
          value={productName}
          error={errors.productName}
          onChangeText={(t) => {
            setProductName(t);
            clearError('productName');
          }}
        />
        <Field
          styles={styles}
          label="Brand"
          required
          value={brandName}
          error={errors.brandName}
          onChangeText={(t) => {
            setBrandName(t);
            clearError('brandName');
          }}
        />
        <Field
          styles={styles}
          label="Product URL"
          required
          value={productUrl}
          error={errors.productUrl}
          onChangeText={(t) => {
            setProductUrl(t);
            clearError('productUrl');
          }}
          autoCapitalize="none"
          keyboardType="url"
        />
        <Field
          styles={styles}
          label="Current Price"
          value={currentPrice}
          error={errors.currentPrice}
          onChangeText={(t) => {
            setCurrentPrice(t);
            clearError('currentPrice');
          }}
          keyboardType="decimal-pad"
          placeholder="4499"
        />
        <Field
          styles={styles}
          label="Original Price"
          value={originalPrice}
          error={errors.originalPrice}
          onChangeText={(t) => {
            setOriginalPrice(t);
            clearError('originalPrice');
          }}
          keyboardType="decimal-pad"
          placeholder="5999"
        />
        <Field
          styles={styles}
          label="Product Image URL"
          value={imageUrl}
          error={errors.imageUrl}
          onChangeText={(t) => {
            setImageUrl(t);
            clearError('imageUrl');
          }}
          autoCapitalize="none"
        />
        <Field styles={styles} label="SKU / Product ID" value={sku} onChangeText={setSku} />
        <Field styles={styles} label="Product Variant" value={variant} onChangeText={setVariant} />

        <PrimaryButton label="Continue" onPress={onContinue} style={{ marginTop: SPACING.two }} />
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
    preview: { alignItems: 'center', marginVertical: SPACING.one },
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
    inputError: { borderColor: colors.error },
    errorText: { ...TYPOGRAPHY.small, color: colors.error },
    placeholder: { color: colors.mutedInk },
  });
