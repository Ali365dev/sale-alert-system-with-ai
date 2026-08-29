import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import useTheme from '../hooks/useTheme';

/** Shared "DealPulse" wordmark — "Deal" in the base text color, "Pulse" in brand red, capped
 * with a red pulse-line mark. Centralized so every header/hero renders the same brand instead of
 * each screen re-implementing its own split-color text. */
const Logo = ({ size = 20, light = false, style }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(), []);

  return (
    <View style={[styles.row, style]}>
      <Text style={[styles.word, { fontSize: size, color: light ? '#FFFFFF' : colors.text }]}>Deal</Text>
      <Text style={[styles.word, { fontSize: size, color: colors.primary }]}>Pulse</Text>
      <Icon name="pulse" size={size} color={colors.primary} style={styles.icon} />
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
    icon: {
      marginLeft: 4,
    },
  });
