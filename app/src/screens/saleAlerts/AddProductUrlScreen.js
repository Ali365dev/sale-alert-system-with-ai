import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Screen from '../../components/Screen';
import TopAppBar from '../../components/TopAppBar';
import PrimaryButton from '../../components/PrimaryButton';
import SecondaryButton from '../../components/SecondaryButton';
import OnboardingProgress from '../../components/OnboardingProgress';
import { RADIUS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import useTheme from '../../hooks/useTheme';
import useCreateAlertDraftStore from '../../state/createAlertDraftStore';
import { validateProductUrl } from '../../utils/saleAlertValidation';
import { showErrorToast } from '../../utils/CustomToast';

const AddProductUrlScreen = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const productUrl = useCreateAlertDraftStore((s) => s.productUrl);
  const setField = useCreateAlertDraftStore((s) => s.setField);
  const [url, setUrl] = useState(productUrl || '');
  const [error, setError] = useState('');

  const onChangeUrl = (text) => {
    setUrl(text);
    if (error) setError('');
  };

  const onAnalyze = () => {
    const result = validateProductUrl(url);
    if (!result.ok) {
      setError(result.error);
      showErrorToast(result.error);
      return;
    }
    setField('productUrl', result.value);
    navigation.navigate('AnalyzeProductScreen', { url: result.value });
  };

  return (
    <Screen style={styles.root}>
      <TopAppBar title="Add Product" showBack hideProfile />
      <View style={styles.body}>
        <OnboardingProgress step={1} total={5} />
        <Text style={styles.heading}>Paste Product URL</Text>
        <Text style={styles.sub}>
          We will attempt to identify the product name, brand, price, and image automatically.
        </Text>
        <View style={styles.field}>
          <Text style={styles.label}>Product link</Text>
          <TextInput
            style={[styles.input, error ? styles.inputError : null]}
            value={url}
            onChangeText={onChangeUrl}
            placeholder="https://example.com/product/..."
            placeholderTextColor={colors.mutedInk}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
        <PrimaryButton label="Analyze Product" onPress={onAnalyze} disabled={!url.trim()} />
        <SecondaryButton
          label="Enter details manually"
          onPress={() => {
            const trimmed = url.trim();
            if (trimmed) {
              const result = validateProductUrl(trimmed);
              if (!result.ok) {
                setError(result.error);
                showErrorToast(result.error);
                return;
              }
              setField('productUrl', result.value);
            } else {
              setField('productUrl', '');
            }
            setField('analyzeFailed', true);
            navigation.navigate('ManualProductScreen');
          }}
        />
      </View>
    </Screen>
  );
};

export default AddProductUrlScreen;

const createStyles = (colors) =>
  StyleSheet.create({
    root: { flex: 1 },
    body: { padding: SPACING.four, gap: SPACING.three },
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
    inputError: { borderColor: colors.error },
    errorText: { ...TYPOGRAPHY.small, color: colors.error },
  });
