import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';

import { usePressScale } from './use-press-scale';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
}

export function OptionCard({ icon, title, subtitle, selected, onPress }: Props) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.98);

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[styles.card, selected && styles.cardSelected]}>
        <View style={[styles.iconCircle, selected && styles.iconCircleSelected]}>
          <Ionicons name={icon} size={22} color={selected ? '#FFFFFF' : '#B7131A'} />
        </View>
        <View style={styles.textBlock}>
          <ThemedText type="smallBold">{title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {subtitle}
          </ThemedText>
        </View>
        {selected && <Ionicons name="checkmark-circle" size={22} color="#B7131A" />}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: '#F0DADA',
    padding: Spacing.three,
  },
  cardSelected: {
    borderColor: '#B7131A',
    borderWidth: 2,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F8F9FB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleSelected: {
    backgroundColor: '#B7131A',
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
});
