import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, TextInput, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onSubmitEditing?: () => void;
  autoFocus?: boolean;
  showMic?: boolean;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search brands, deals, categories',
  onSubmitEditing,
  autoFocus,
  showMic,
}: Props) {
  return (
    <View style={styles.container}>
      <Ionicons name="search" size={18} color="#6B7280" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#6B7280"
        style={styles.input}
        onSubmitEditing={onSubmitEditing}
        autoFocus={autoFocus}
        returnKeyType="search"
      />
      {showMic && <Ionicons name="mic-outline" size={18} color="#6B7280" />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: '#F8F9FB',
    borderRadius: Radius.chip,
    paddingHorizontal: Spacing.three,
    height: 48,
  },
  input: {
    flex: 1,
    fontFamily: 'Montserrat_500Medium',
    fontSize: 15,
    color: '#171717',
  },
});
