import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { CategoryInfo } from '@/types/dealpulse';

import { usePressScale } from './use-press-scale';

interface Props {
  category: CategoryInfo;
  onPress?: () => void;
  variant?: 'default' | 'compact';
}

export function CategoryCard({ category, onPress, variant = 'default' }: Props) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  const compact = variant === 'compact';

  return (
    <Animated.View style={[animatedStyle, styles.wrapper]}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[styles.card, compact ? styles.cardCompact : styles.cardDefault]}>
        {compact ? (
          <MaterialCommunityIcons name={category.icon as never} size={26} color="#B7131A" style={styles.compactIcon} />
        ) : (
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name={category.icon as never} size={24} color="#B7131A" />
          </View>
        )}
        <ThemedText type="smallBold">{category.name}</ThemedText>
        {compact ? (
          <ThemedText type="small" themeColor="textSecondary">
            {category.dealCount.toLocaleString()} Deals
          </ThemedText>
        ) : (
          <View style={styles.countChip}>
            <ThemedText type="small" themeColor="textSecondary">
              {category.dealCount.toLocaleString()} deals
            </ThemedText>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexBasis: '48%',
  },
  card: {
    borderRadius: Radius.card,
    padding: Spacing.three,
    gap: 4,
  },
  cardCompact: {
    backgroundColor: '#F8F9FB',
  },
  cardDefault: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0DADA',
    alignItems: 'center',
    paddingVertical: Spacing.four,
  },
  compactIcon: {
    marginBottom: Spacing.one,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  countChip: {
    backgroundColor: '#F0F0F0',
    borderRadius: Radius.chip,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    marginTop: 2,
  },
});
