import { useCallback, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Screen from '../../components/Screen';
import TopAppBar from '../../components/TopAppBar';
import PrimaryButton from '../../components/PrimaryButton';
import BrandPickerSheet from '../../components/BrandPickerSheet';
import OnboardingProgress from '../../components/OnboardingProgress';
import { SPACING, TYPOGRAPHY } from '../../styles/theme';
import useTheme from '../../hooks/useTheme';
import useDataStore from '../../state/dataStore';
import useCreateAlertDraftStore from '../../state/createAlertDraftStore';

/** Fallback route — opens the same brand bottom sheet used on Create Alert. */
const SelectBrandForAlertScreen = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const brands = useDataStore((s) => s.brands);
  const setField = useCreateAlertDraftStore((s) => s.setField);
  const brandName = useCreateAlertDraftStore((s) => s.brandName);
  const sheetRef = useRef(null);

  useFocusEffect(
    useCallback(() => {
      const t = setTimeout(() => sheetRef.current?.present(), 80);
      return () => clearTimeout(t);
    }, []),
  );

  const onBrandSelected = (selection) => {
    setField('alertType', 'brand');
    setField('brandName', selection.name);
    setField('imageUrl', selection.logoUrl || '');
    setField('productName', '');
    setField('productUrl', '');
    navigation.navigate('AlertConditionsScreen');
  };

  return (
    <Screen style={styles.root}>
      <TopAppBar title="Select Brand" showBack hideProfile />
      <View style={styles.body}>
        <OnboardingProgress step={1} total={5} />
        <Text style={styles.heading}>Select Brand</Text>
        <Text style={styles.sub}>Pick a brand from the list, or add a custom one.</Text>
        <PrimaryButton label="Browse brands" onPress={() => sheetRef.current?.present()} />
      </View>
      <BrandPickerSheet
        ref={sheetRef}
        brands={brands}
        selectedName={brandName}
        onSelect={onBrandSelected}
      />
    </Screen>
  );
};

export default SelectBrandForAlertScreen;

const createStyles = (colors) =>
  StyleSheet.create({
    root: { flex: 1 },
    body: { flex: 1, padding: SPACING.four, gap: SPACING.three },
    heading: { ...TYPOGRAPHY.headline, color: colors.text, marginTop: SPACING.two },
    sub: { ...TYPOGRAPHY.small, color: colors.textSecondary },
  });
