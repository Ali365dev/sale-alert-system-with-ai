import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BottomSheetBackdrop,
  BottomSheetFlatList,
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import Icon from 'react-native-vector-icons/Ionicons';
import { RADIUS, SPACING, TYPOGRAPHY } from '../styles/theme';
import useTheme from '../hooks/useTheme';
import BrandLogo from './BrandLogo';
import PrimaryButton from './PrimaryButton';

const SNAP_POINTS = ['72%', '92%'];
const MAX_CUSTOM_NAME = 300;

/**
 * Brand picker for Sale Alerts — logos, category/deal meta, + custom brand.
 * Call ref.present() / ref.dismiss().
 */
const BrandPickerSheet = forwardRef(({ brands = [], selectedName, onSelect, onClose }, ref) => {
  const sheetRef = useRef(null);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('list'); // list | custom
  const [customName, setCustomName] = useState('');
  const [customError, setCustomError] = useState('');

  useImperativeHandle(ref, () => ({
    present: () => {
      setMode('list');
      setQuery('');
      setCustomName('');
      setCustomError('');
      sheetRef.current?.present();
    },
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  const sorted = useMemo(() => {
    const list = [...brands];
    list.sort(
      (a, b) =>
        (b.dealCount || 0) - (a.dealCount || 0) ||
        String(a.name || '').localeCompare(String(b.name || '')),
    );
    return list;
  }, [brands]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((b) => {
      const name = (b.name || '').toLowerCase();
      const category = (b.category || '').toLowerCase();
      const website = (b.website || '').toLowerCase();
      return name.includes(q) || category.includes(q) || website.includes(q);
    });
  }, [sorted, query]);

  const renderBackdrop = useCallback(
    (props) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    [],
  );

  const pickBrand = (brand) => {
    onSelect?.({
      name: brand.name,
      logoUrl: brand.logoUrl || brand.logo_url || '',
      website: brand.website || '',
      category: brand.category || '',
      custom: false,
      brand,
    });
    sheetRef.current?.dismiss();
  };

  const submitCustom = () => {
    const name = customName.trim();
    if (!name) {
      setCustomError('Enter a brand name.');
      return;
    }
    if (name.length > MAX_CUSTOM_NAME) {
      setCustomError('Brand name is too long.');
      return;
    }
    setCustomError('');
    onSelect?.({
      name,
      logoUrl: '',
      website: '',
      category: '',
      custom: true,
      brand: null,
    });
    sheetRef.current?.dismiss();
  };

  const queryMatchExists = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return filtered.some((b) => (b.name || '').toLowerCase() === q);
  }, [filtered, query]);

  return (
    <BottomSheetModal
      ref={sheetRef}
      onDismiss={() => {
        setMode('list');
        onClose?.();
      }}
      snapPoints={SNAP_POINTS}
      enableDynamicSizing={false}
      enablePanDownToClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handle}>
      {mode === 'custom' ? (
        <BottomSheetView style={[styles.customBody, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <Pressable
            style={styles.backRow}
            onPress={() => {
              setMode('list');
              setCustomError('');
            }}
            accessibilityRole="button"
            accessibilityLabel="Back to brand list">
            <Icon name="chevron-back" size={20} color={colors.text} />
            <Text style={styles.backLabel}>All brands</Text>
          </Pressable>
          <Text style={styles.title}>Custom brand</Text>
          <Text style={styles.subtitle}>Track a brand that isn’t in the list yet.</Text>
          <View style={styles.field}>
            <Text style={styles.label}>Brand name</Text>
            <BottomSheetTextInput
              style={[styles.search, customError ? styles.inputError : null]}
              value={customName}
              onChangeText={(t) => {
                setCustomName(t);
                if (customError) setCustomError('');
              }}
              placeholder="e.g. Breakout"
              placeholderTextColor={colors.mutedInk}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={submitCustom}
            />
            {customError ? <Text style={styles.errorText}>{customError}</Text> : null}
          </View>
          <PrimaryButton label="Continue" onPress={submitCustom} disabled={!customName.trim()} />
        </BottomSheetView>
      ) : (
        <>
          <View style={styles.header}>
            <Text style={styles.title}>Select a brand</Text>
            <Text style={styles.subtitle}>We’ll notify you when this brand goes on sale.</Text>
            <BottomSheetTextInput
              style={styles.search}
              value={query}
              onChangeText={setQuery}
              placeholder="Search brands"
              placeholderTextColor={colors.mutedInk}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
          </View>

          <Pressable
            style={styles.customCard}
            onPress={() => {
              setCustomName(query.trim());
              setMode('custom');
            }}
            accessibilityRole="button"
            accessibilityLabel="Add a custom brand">
            <View style={[styles.customIcon, { backgroundColor: colors.primarySoft }]}>
              <Icon name="add" size={22} color={colors.primary} />
            </View>
            <View style={styles.customText}>
              <Text style={styles.customTitle}>
                {query.trim() && !queryMatchExists
                  ? `Add “${query.trim()}” as custom brand`
                  : 'Add a custom brand'}
              </Text>
              <Text style={styles.customHint}>Not in the list? Track any brand by name.</Text>
            </View>
            <Icon name="chevron-forward" size={18} color={colors.textSecondary} />
          </Pressable>

          <BottomSheetFlatList
            data={filtered}
            keyExtractor={(item) => String(item.id ?? item.name)}
            contentContainerStyle={[styles.list, { paddingBottom: Math.max(insets.bottom, 20) }]}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.empty}>No brands match your search.</Text>
                {query.trim() ? (
                  <Pressable
                    onPress={() => {
                      setCustomName(query.trim());
                      setMode('custom');
                    }}>
                    <Text style={styles.emptyLink}>Use “{query.trim()}” as a custom brand</Text>
                  </Pressable>
                ) : null}
              </View>
            }
            renderItem={({ item }) => {
              const active =
                selectedName &&
                String(selectedName).trim().toLowerCase() === String(item.name || '').trim().toLowerCase();
              const deals = item.dealCount ?? 0;
              const metaParts = [];
              if (item.category) metaParts.push(item.category);
              if (deals > 0) metaParts.push(`${deals} deal${deals === 1 ? '' : 's'}`);
              else if (item.website) metaParts.push(String(item.website).replace(/^https?:\/\//i, ''));

              return (
                <Pressable
                  style={[styles.row, active && styles.rowSelected]}
                  onPress={() => pickBrand(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Brand ${item.name}`}
                  accessibilityState={{ selected: !!active }}>
                  <BrandLogo brand={item} size={44} tone="filled" fit="cover" />
                  <View style={styles.rowText}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {metaParts.length ? (
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        {metaParts.join(' · ')}
                      </Text>
                    ) : (
                      <Text style={styles.rowMeta}>Brand alert</Text>
                    )}
                  </View>
                  {active ? (
                    <Icon name="checkmark-circle" size={22} color={colors.primary} />
                  ) : (
                    <Icon name="chevron-forward" size={18} color={colors.textSecondary} />
                  )}
                </Pressable>
              );
            }}
          />
        </>
      )}
    </BottomSheetModal>
  );
});

BrandPickerSheet.displayName = 'BrandPickerSheet';

export default BrandPickerSheet;

const createStyles = (colors) =>
  StyleSheet.create({
    background: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
    },
    handle: {
      backgroundColor: colors.border,
      width: 40,
      height: 4,
    },
    header: {
      paddingHorizontal: 24,
      paddingTop: 4,
      paddingBottom: 12,
      gap: 8,
    },
    title: {
      ...TYPOGRAPHY.subtitle,
      color: colors.text,
      fontSize: 20,
      fontWeight: '800',
    },
    subtitle: {
      ...TYPOGRAPHY.small,
      color: colors.textSecondary,
    },
    search: {
      ...TYPOGRAPHY.default,
      color: colors.text,
      backgroundColor: colors.backgroundElement,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.chip,
      paddingHorizontal: SPACING.three,
      paddingVertical: SPACING.two + 4,
      marginTop: 4,
    },
    inputError: { borderColor: colors.error },
    errorText: { ...TYPOGRAPHY.small, color: colors.error },
    customCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginHorizontal: 16,
      marginBottom: 10,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
      backgroundColor: colors.surface,
    },
    customIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    customText: { flex: 1, gap: 2 },
    customTitle: { ...TYPOGRAPHY.smallBold, color: colors.text },
    customHint: { ...TYPOGRAPHY.small, fontSize: 12, color: colors.textSecondary },
    list: {
      paddingHorizontal: 16,
      gap: 6,
    },
    emptyWrap: { alignItems: 'center', gap: 8, paddingVertical: 28 },
    empty: {
      ...TYPOGRAPHY.default,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    emptyLink: {
      ...TYPOGRAPHY.smallBold,
      color: colors.primary,
      textAlign: 'center',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      marginBottom: 6,
    },
    rowSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    rowText: { flex: 1, gap: 2 },
    rowName: { ...TYPOGRAPHY.smallBold, color: colors.text },
    rowMeta: { ...TYPOGRAPHY.small, fontSize: 12, color: colors.textSecondary },
    customBody: {
      paddingHorizontal: 24,
      paddingTop: 4,
      gap: 12,
    },
    backRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      alignSelf: 'flex-start',
      marginBottom: 4,
    },
    backLabel: { ...TYPOGRAPHY.smallBold, color: colors.text },
    field: { gap: 6 },
    label: { ...TYPOGRAPHY.label, color: colors.text },
  });
