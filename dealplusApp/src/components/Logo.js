import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import useTheme from '../hooks/useTheme';

/** Shared "Deals More" wordmark — "Deals" in the base text color, "More" in brand red.
 * Centralized so every header/hero renders the same brand instead of each screen
 * re-implementing its own split-color text. */
const Logo = ({ size = 20, light = false, style }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(), []);

  return (
    <View style={[styles.row, style]}>
      <Text style={[styles.word, { fontSize: size, color: light ? '#FFFFFF' : colors.text }]}>Deals</Text>
      <Text style={[styles.word, { fontSize: size, color: colors.primary }]}> More</Text>
    </View>
  );
};

export default Logo;

const createStyles = () =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    word: {
      fontWeight: '800',
      letterSpacing: -0.5,
    },
  });
