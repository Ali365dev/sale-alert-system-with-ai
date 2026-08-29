import { useMemo } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { RADIUS, SPACING } from '../styles/theme';
import useTheme from '../hooks/useTheme';

const SearchBar = ({ value, onChangeText, placeholder = 'Search brands, deals, categories', onSubmitEditing, autoFocus, showMic }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <Icon name="search" size={18} color={colors.textSecondary} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        style={styles.input}
        onSubmitEditing={onSubmitEditing}
        autoFocus={autoFocus}
        returnKeyType="search"
      />
      {showMic && <Icon name="mic-outline" size={18} color={colors.textSecondary} />}
    </View>
  );
};

export default SearchBar;

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.two,
      backgroundColor: colors.backgroundElement,
      borderRadius: RADIUS.chip,
      paddingHorizontal: SPACING.three,
      height: 48,
    },
    input: {
      flex: 1,
      fontSize: 15,
      fontWeight: '500',
      color: colors.text,
    },
  });
