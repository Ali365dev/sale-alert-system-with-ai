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

const AddProductUrlScreen = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const productUrl = useCreateAlertDraftStore((s) => s.productUrl);
  const setField = useCreateAlertDraftStore((s) => s.setField);
  const [url, setUrl] = useState(productUrl || '');

  const onAnalyze = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setField('productUrl', trimmed);
    navigation.navigate('AnalyzeProductScreen', { url: trimmed });
  };

  return (
    <Screen style={styles.root}>
      <TopAppBar title="Add Product" showBack hideProfile />
      <View style={styles.body}>
        <OnboardingProgress step={1} total={5} />
        <Text style={styles.heading}>Paste Product URL</Text>
        <Text style={styles.sub}>We'll try to automatically identify the product, brand, price, and image.</Text>
        <TextInput
          style={styles.input}
          value={url}
          onChangeText={setUrl}
          placeholder="https://example.com/product/..."
          placeholderTextColor={colors.mutedInk}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <PrimaryButton label="Analyze Product" onPress={onAnalyze} disabled={!url.trim()} />
        <SecondaryButton
          label="Enter details manually"
          onPress={() => {
            setField('productUrl', url.trim());
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
  });
