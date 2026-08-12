import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

interface Props {
  initials: string;
  size?: number;
  tone?: 'outline' | 'filled';
}

export function BrandLogo({ initials, size = 56, tone = 'outline' }: Props) {
  return (
    <View
      style={[
        styles.circle,
        tone === 'outline' ? styles.outline : styles.filled,
        { width: size, height: size, borderRadius: size / 2 },
      ]}>
      <ThemedText type="label" style={{ fontSize: size * 0.32, lineHeight: size * 0.32 * 1.2 }}>
        {initials}
      </ThemedText>
    </View>
  );
}

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
