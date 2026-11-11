import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import Icon from 'react-native-vector-icons/Ionicons';
import { SPACING, TYPOGRAPHY } from '../styles/theme';
import useTheme from '../hooks/useTheme';

/**
 * Generic option picker bottom sheet — call ref.present() / ref.dismiss().
 * options: [{ id, label, color? }] — color renders a leading dot (bank chips).
 */
const FilterPickerSheet = forwardRef(
  ({ title, subtitle, options = [], selected, onSelect, onClose, snapPoint = '60%' }, ref) => {
    const sheetRef = useRef(null);
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const snapPoints = useMemo(() => [snapPoint], [snapPoint]);

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
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.background}
        handleIndicatorStyle={styles.handle}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        <BottomSheetScrollView
          contentContainerStyle={[styles.list, { paddingBottom: Math.max(insets.bottom, 20) }]}
          showsVerticalScrollIndicator={false}>
          {options.map((option) => {
            const isSelected = selected === option.id;
            return (
              <Pressable
                key={String(option.id)}
                style={[styles.option, isSelected && styles.optionSelected]}
                onPress={() => {
                  onSelect?.(option.id);
                  sheetRef.current?.dismiss();
                }}
                accessibilityRole="button"
                accessibilityLabel={option.label}
                accessibilityState={{ selected: isSelected }}>
                {option.color ? (
                  <View style={[styles.dot, { backgroundColor: option.color }]} />
                ) : option.icon ? (
                  <Icon name={option.icon} size={16} color={isSelected ? colors.primary : colors.textSecondary} />
                ) : null}
                <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                  {option.label}
                </Text>
                {option.count != null ? (
                  <Text style={[styles.count, { color: colors.textSecondary }]}>{option.count}</Text>
                ) : null}
                {isSelected ? <Icon name="checkmark" size={18} color={colors.primary} /> : null}
              </Pressable>
            );
          })}
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  },
);

FilterPickerSheet.displayName = 'FilterPickerSheet';

export default FilterPickerSheet;

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
      paddingTop: 8,
      paddingBottom: SPACING.two,
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
      marginTop: 2,
    },
    list: {
      paddingHorizontal: 24,
      gap: 10,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    optionSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    optionLabel: {
      ...TYPOGRAPHY.default,
      color: colors.text,
      flex: 1,
      fontWeight: '600',
    },
    optionLabelSelected: {
      color: colors.text,
    },
    count: {
      fontSize: 13,
      fontWeight: '500',
    },
  });
