import { StyleSheet, Text, View } from 'react-native';

const BrandLogo = ({ initials, size = 56, tone = 'outline' }) => {
  return (
    <View
      style={[
        styles.circle,
        tone === 'outline' ? styles.outline : styles.filled,
        { width: size, height: size, borderRadius: size / 2 },
      ]}>
      <Text style={{ fontSize: size * 0.32, lineHeight: size * 0.32 * 1.2, fontWeight: '700' }}>{initials}</Text>
    </View>
  );
};

export default BrandLogo;

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  outline: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0DADA',
  },
  filled: {
    backgroundColor: '#EDEDED',
  },
});
