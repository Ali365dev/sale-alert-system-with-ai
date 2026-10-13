import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Screen from '../../components/Screen';
import TopAppBar from '../../components/TopAppBar';
import BrandLogo from '../../components/BrandLogo';
import OnboardingProgress from '../../components/OnboardingProgress';
import { RADIUS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import useTheme from '../../hooks/useTheme';
import useDataStore from '../../state/dataStore';
import useCreateAlertDraftStore from '../../state/createAlertDraftStore';

const SelectBrandForAlertScreen = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const brands = useDataStore((s) => s.brands);
  const setField = useCreateAlertDraftStore((s) => s.setField);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...brands];
    if (!q) return list;
    return list.filter((b) => (b.name || '').toLowerCase().includes(q));
  }, [brands, query]);

  const pick = (brand) => {
    setField('alertType', 'brand');
    setField('brandName', brand.name);
    setField('imageUrl', brand.logoUrl || brand.logo_url || '');
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
        <TextInput
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          placeholder="Search brands"
          placeholderTextColor={colors.mutedInk}
        />
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id ?? item.name)}
          contentContainerStyle={{ gap: SPACING.two, paddingBottom: SPACING.six }}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => pick(item)}>
              <BrandLogo brand={item} size={40} tone="filled" fit="cover" />
              <Text style={styles.name}>{item.name}</Text>
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No brands match your search.</Text>}
        />
      </View>
    </Screen>
  );
};

export default SelectBrandForAlertScreen;

const createStyles = (colors) =>
  StyleSheet.create({
    root: { flex: 1 },
    body: { flex: 1, paddingHorizontal: SPACING.four, paddingTop: SPACING.three, gap: SPACING.three },
    heading: { ...TYPOGRAPHY.headline, color: colors.text },
    search: {
      ...TYPOGRAPHY.default,
      color: colors.text,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.chip,
      paddingHorizontal: SPACING.three,
      paddingVertical: SPACING.two + 4,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.three,
      backgroundColor: colors.surface,
      borderRadius: RADIUS.card,
      padding: SPACING.three,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    name: { ...TYPOGRAPHY.smallBold, color: colors.text, flex: 1 },
    empty: { ...TYPOGRAPHY.small, color: colors.textSecondary, textAlign: 'center', marginTop: SPACING.four },
  });
