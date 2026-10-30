import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetBackdrop, BottomSheetFlatList, BottomSheetModal } from '@gorhom/bottom-sheet';
import Icon from 'react-native-vector-icons/Ionicons';
import { SPACING, TYPOGRAPHY } from '../styles/theme';
import useTheme from '../hooks/useTheme';

const SNAP_POINTS = ['55%'];

/**
 * Category picker — call ref.present() / ref.dismiss().
 */
const CategoryPickerSheet = forwardRef(({ categories = [], selected, onSelect, onClose }, ref) => {
  const sheetRef = useRef(null);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const data = useMemo(() => categories.map((c) => (typeof c === 'string' ? { name: c } : c)), [categories]);

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
    dismiss: () => sheetRef.current?.dismiss(),
  }));

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

  return (
    <BottomSheetModal
      ref={sheetRef}
      onDismiss={onClose}
      snapPoints={SNAP_POINTS}
      enableDynamicSizing={false}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handle}>
      <View style={styles.header}>
        <Text style={styles.title}>Select a category</Text>
        <Text style={styles.subtitle}>Choose where this brand fits best</Text>
      </View>
      <BottomSheetFlatList
        data={data}
        keyExtractor={(item) => item.name}
        contentContainerStyle={[styles.list, { paddingBottom: Math.max(insets.bottom, 20) }]}
        ListEmptyComponent={<Text style={styles.empty}>No categories available yet.</Text>}
        renderItem={({ item }) => {
          const active = selected === item.name;
          return (
            <Pressable
              style={[styles.row, active && styles.rowSelected]}
              onPress={() => {
                onSelect?.(item.name);
                sheetRef.current?.dismiss();
              }}
              accessibilityRole="button"
              accessibilityLabel={`Category ${item.name}`}
              accessibilityState={{ selected: active }}>
              <Text style={[styles.rowLabel, active && styles.rowLabelSelected]}>{item.name}</Text>
              {active ? <Icon name="checkmark" size={18} color={colors.primary} /> : null}
            </Pressable>
          );
        }}
      />
    </BottomSheetModal>
  );
});

CategoryPickerSheet.displayName = 'CategoryPickerSheet';

export default CategoryPickerSheet;

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
      gap: 4,
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
    list: {
      paddingHorizontal: 16,
      gap: 6,
    },
    empty: {
      ...TYPOGRAPHY.default,
      color: colors.textSecondary,
      textAlign: 'center',
      paddingVertical: 24,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: 14,
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
    rowLabel: {
      ...TYPOGRAPHY.default,
      color: colors.text,
      fontWeight: '600',
      flex: 1,
    },
    rowLabelSelected: {
      color: colors.text,
    },
  });
