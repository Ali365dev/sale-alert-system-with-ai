import { StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

const DARK_TEXT_TONES = ['yellow', 'gray'];

const SaleBadge = ({ label, tone = 'red', icon }) => {
  const isDarkText = DARK_TEXT_TONES.includes(tone);
  return (
    <View style={[styles.badge, styles[tone]]}>
      {icon && <Icon name={icon} size={10} color={isDarkText ? '#171717' : '#FFFFFF'} />}
      <Text style={[styles.text, isDarkText ? styles.textDark : styles.textLight]}>{label}</Text>
    </View>
  );
};

export default SaleBadge;

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  red: {
    backgroundColor: '#DB322F',
  },
  yellow: {
    backgroundColor: '#F5CB1B',
  },
  gray: {
    backgroundColor: '#E5E7EB',
  },
  green: {
    backgroundColor: '#16A34A',
  },
  text: {
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 0.4,
    fontWeight: '700',
  },
  textLight: {
    color: '#FFFFFF',
  },
  textDark: {
    color: '#171717',
  },
});
