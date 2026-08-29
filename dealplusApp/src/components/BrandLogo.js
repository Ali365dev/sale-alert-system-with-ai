import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import useTheme from '../hooks/useTheme';

const BrandLogo = ({ initials, size = 56, tone = 'outline' }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isFilled = tone === 'filled';

  return (
    <View
      style={[
        styles.circle,
        isFilled ? styles.filled : styles.outline,
        { width: size, height: size, borderRadius: size / 2 },
      ]}>
      <Text
        style={{
          fontSize: size * 0.32,
          lineHeight: size * 0.32 * 1.2,
          fontWeight: '700',
          color: isFilled ? '#FFFFFF' : colors.text,
        }}>
        {initials}
      </Text>
    </View>
  );
};

export default BrandLogo;

const createStyles = (colors) =>
  StyleSheet.create({
    circle: {
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    outline: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filled: {
      // Deliberately theme-invariant — a solid dark accent chip, not tied to
      // the surrounding page background.
      backgroundColor: '#171717',
    },
  });
