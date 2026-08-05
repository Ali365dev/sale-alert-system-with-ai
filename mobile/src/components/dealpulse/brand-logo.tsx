import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

interface Props {
  initials: string;
  size?: number;
}

export function BrandLogo({ initials, size = 56 }: Props) {
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2 },
      ]}>
      <ThemedText type="label" style={{ fontSize: size * 0.32 }}>
        {initials}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
