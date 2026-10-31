import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { RADIUS, SPACING, TYPOGRAPHY } from '../styles/theme';
import useTheme from '../hooks/useTheme';
import { REGIONS, SUPPORTED_CODES } from '../config/regions';

const COUNTRY_LIST = SUPPORTED_CODES.map((code) => ({ code, ...REGIONS[code] }));

export default function CountryPicker({ value, onChange, error }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [open, setOpen] = useState(false);

  const selected = value ? REGIONS[value] : null;

  const handleSelect = (code) => {
    onChange(code);
    setOpen(false);
  };

  return (
    <>
      <View style={styles.fieldBlock}>
        <Text style={styles.fieldLabel}>Country</Text>
        <Pressable
          style={[styles.fieldRow, error && styles.fieldRowError]}
          onPress={() => setOpen(true)}>
          <Text style={[styles.fieldInput, !selected && styles.placeholder]}>
            {selected ? `${selected.flag}  ${selected.name}` : 'Select country'}
          </Text>
          <Icon name="chevron-down" size={18} color={colors.textSecondary} />
        </Pressable>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Select Country</Text>
            <Pressable onPress={() => setOpen(false)} hitSlop={8}>
              <Icon name="close" size={22} color={colors.text} />
            </Pressable>
          </View>
          <FlatList
            data={COUNTRY_LIST}
            keyExtractor={(item) => item.code}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.option, value === item.code && styles.optionSelected]}
                onPress={() => handleSelect(item.code)}>
                <Text style={styles.optionFlag}>{item.flag}</Text>
                <Text style={[styles.optionName, value === item.code && styles.optionNameSelected]}>
                  {item.name}
                </Text>
                {value === item.code ? (
                  <Icon name="checkmark" size={18} color={colors.primary} />
                ) : null}
              </Pressable>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        </View>
      </Modal>
    </>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
    fieldBlock: { marginBottom: 14 },
    fieldLabel: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 8,
    },
    fieldRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      height: 52,
      backgroundColor: colors.surface,
    },
    fieldRowError: { borderColor: colors.primary },
    fieldInput: {
      flex: 1,
      fontSize: 15,
      fontWeight: '500',
      color: colors.text,
    },
    placeholder: { color: colors.textSecondary },
    errorText: {
      ...TYPOGRAPHY.small,
      fontSize: 12,
      color: colors.primary,
      marginTop: 6,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    sheet: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '70%',
      paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.four,
      paddingVertical: SPACING.three,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sheetTitle: {
      ...TYPOGRAPHY.body,
      fontWeight: '700',
      color: colors.text,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.three,
      paddingHorizontal: SPACING.four,
      paddingVertical: 14,
    },
    optionSelected: { backgroundColor: colors.border + '40' },
    optionFlag: { fontSize: 22 },
    optionName: {
      ...TYPOGRAPHY.body,
      flex: 1,
      color: colors.text,
    },
    optionNameSelected: { fontWeight: '700', color: colors.primary },
    separator: { height: 1, backgroundColor: colors.border, marginHorizontal: SPACING.four },
  });
