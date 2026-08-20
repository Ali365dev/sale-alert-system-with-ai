import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SPACING, TYPOGRAPHY } from '../styles/theme';
import BrandLogo from './BrandLogo';
import { usePressScale } from '../hooks/usePressScale';

const BrandCard = ({ brand, onPress, variant = 'default' }) => {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  const isAvatar = variant === 'avatar';

  return (
    <Animated.View style={animatedStyle}>
      <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} style={styles.card}>
        <BrandLogo initials={brand.initials} size={64} tone={isAvatar ? 'filled' : 'outline'} />
        <View style={styles.textBlock}>
          <Text style={styles.name} numberOfLines={1}>
            {brand.name}
          </Text>
          {!isAvatar && (
            <Text style={styles.dealCount} numberOfLines={1}>
              {brand.dealCount} deals
            </Text>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
};

export default BrandCard;

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    width: 84,
    gap: SPACING.two,
  },
  textBlock: {
    alignItems: 'center',
  },
  name: {
    ...TYPOGRAPHY.smallBold,
  },
  dealCount: {
    ...TYPOGRAPHY.small,
    color: '#6B7280',
  },
});
