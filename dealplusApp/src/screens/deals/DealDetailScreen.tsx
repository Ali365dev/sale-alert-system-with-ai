import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../styles/theme';

export function DealDetailScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Deal detail</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
});
