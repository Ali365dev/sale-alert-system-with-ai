import { StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

const DARK_TEXT_TONES = ['yellow', 'gray'];

const SaleBadge = ({ label, tone = 'red', icon }) => {
  const isDarkText = DARK_TEXT_TONES.includes(tone);
  return (
    <View style={[styles.badge, styles[tone]]}>
      {icon && <Icon name={icon} size={10} color={isDarkText ? '#10233F' : '#FFFFFF'} />}
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
    backgroundColor: '#F20D38',
  },
  yellow: {
    backgroundColor: '#F5A623',
  },
  gray: {
    backgroundColor: '#F3F5F8',
  },
  green: {
    backgroundColor: '#16A36A',
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
    color: '#10233F',
  },
});
