import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import Icon from 'react-native-vector-icons/Ionicons';
import { SPACING, TYPOGRAPHY } from '../styles/theme';
import useTheme from '../hooks/useTheme';

const SNAP_POINTS = ['42%'];

export const CHANNEL_FILTERS = [
  { id: 'all', label: 'All', icon: 'apps-outline' },
  { id: 'ONLINE', label: 'Online', icon: 'globe-outline' },
  { id: 'IN-STORE', label: 'In-Store', icon: 'storefront-outline' },
];

/**
 * Channel filter bottom sheet — call ref.present() / ref.dismiss().
 */
const DealFilterSheet = forwardRef(({ channel, onSelect, onClose }, ref) => {
  const sheetRef = useRef(null);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

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
      <BottomSheetView style={[styles.body, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <Text style={styles.title}>Filter</Text>
        <Text style={styles.subtitle}>Show deals by channel</Text>
        <View style={styles.options}>
          {CHANNEL_FILTERS.map((option) => {
            const selected = channel === option.id;
            return (
              <Pressable
                key={option.id}
                style={[styles.option, selected && styles.optionSelected]}
                onPress={() => {
                  onSelect?.(option.id);
                  sheetRef.current?.dismiss();
                }}
                accessibilityRole="button"
                accessibilityLabel={`Filter ${option.label}`}
                accessibilityState={{ selected }}>
                <View style={[styles.optionIcon, selected && styles.optionIconSelected]}>
                  <Icon name={option.icon} size={18} color={selected ? '#FFFFFF' : colors.text} />
                </View>
                <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{option.label}</Text>
                {selected ? <Icon name="checkmark" size={18} color={colors.primary} /> : null}
              </Pressable>
            );
          })}
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
});

DealFilterSheet.displayName = 'DealFilterSheet';

export default DealFilterSheet;

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
    body: {
      paddingHorizontal: 24,
      paddingTop: 8,
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
      marginBottom: SPACING.two,
    },
    options: {
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
    optionIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.backgroundElement,
    },
    optionIconSelected: {
      backgroundColor: colors.primary,
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
  });
