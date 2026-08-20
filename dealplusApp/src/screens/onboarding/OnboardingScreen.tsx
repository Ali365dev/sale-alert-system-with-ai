import { StyleSheet, Text, View } from 'react-native';

import { COLORS } from '../../styles/theme';

export function OnboardingScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Onboarding</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  title: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '700',
  },
});
