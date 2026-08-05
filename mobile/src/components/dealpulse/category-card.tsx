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
}

export function CategoryCard({ category, onPress }: Props) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();

  return (
    <Animated.View style={[animatedStyle, styles.wrapper]}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={styles.card}>
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name={category.icon as never} size={26} color="#171717" />
        </View>
        <ThemedText type="smallBold">{category.name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {category.dealCount.toLocaleString()} Deals
        </ThemedText>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexBasis: '48%',
  },
  card: {
    backgroundColor: '#F5F5F5',
    borderRadius: Radius.card,
    padding: Spacing.three,
    gap: 4,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
});
