import { StyleSheet, Text, View } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY } from '../styles/theme';

const OnboardingProgress = ({ step, total }) => {
  return (
    <View style={styles.row}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={styles.track}>
          <View style={[styles.fill, i < step && styles.fillFull, i === step && styles.fillHalf, i > step && styles.fillNone]} />
        </View>
      ))}
      <Text style={styles.label}>
        {step + 1}/{total}
      </Text>
    </View>
  );
};

export default OnboardingProgress;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.two,
  },
  track: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: COLORS.primary,
  },
  fillFull: {
    width: '100%',
  },
  fillHalf: {
    width: '50%',
  },
  fillNone: {
    width: 0,
  },
  label: {
    ...TYPOGRAPHY.small,
    color: COLORS.textSecondary,
  },
});
