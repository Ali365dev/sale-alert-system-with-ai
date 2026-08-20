import { StyleSheet, TextInput, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { RADIUS, SPACING } from '../styles/theme';

const SearchBar = ({ value, onChangeText, placeholder = 'Search brands, deals, categories', onSubmitEditing, autoFocus, showMic }) => {
  return (
    <View style={styles.container}>
      <Icon name="search" size={18} color="#6B7280" />
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
      {showMic && <Icon name="mic-outline" size={18} color="#6B7280" />}
    </View>
  );
};

export default SearchBar;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.two,
    backgroundColor: '#F8F9FB',
    borderRadius: RADIUS.chip,
    paddingHorizontal: SPACING.three,
    height: 48,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#171717',
  },
});
