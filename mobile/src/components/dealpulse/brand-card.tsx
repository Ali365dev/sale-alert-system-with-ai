import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { Brand } from '@/types/dealpulse';

import { BrandLogo } from './brand-logo';
import { usePressScale } from './use-press-scale';

interface Props {
  brand: Brand;
  onPress?: () => void;
  variant?: 'default' | 'avatar';
}

export function BrandCard({ brand, onPress, variant = 'default' }: Props) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  const isAvatar = variant === 'avatar';

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={styles.card}>
        <BrandLogo initials={brand.initials} size={64} tone={isAvatar ? 'filled' : 'outline'} />
        <View style={styles.textBlock}>
          <ThemedText type="smallBold" numberOfLines={1}>
            {brand.name}
          </ThemedText>
          {!isAvatar && (
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {brand.dealCount} deals
            </ThemedText>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    width: 84,
    gap: Spacing.two,
  },
  textBlock: {
    alignItems: 'center',
  },
});
