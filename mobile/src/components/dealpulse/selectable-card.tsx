import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';

import { usePressScale } from './use-press-scale';

interface Props {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  onPress: () => void;
}

export function SelectableCard({ label, icon, selected, onPress }: Props) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.97);

  return (
    <Animated.View style={[animatedStyle, styles.wrapper]}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[styles.card, selected && styles.cardSelected]}>
        {icon && (
          <Ionicons name={icon} size={22} color={selected ? '#FFFFFF' : '#171717'} />
        )}
        <ThemedText type="smallBold" style={selected ? styles.labelSelected : undefined}>
          {label}
        </ThemedText>
        {selected && (
          <View style={styles.checkBadge}>
            <Ionicons name="checkmark" size={12} color="#171717" />
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
    backgroundColor: '#F5F5F5',
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    gap: Spacing.two,
    position: 'relative',
  },
  cardSelected: {
    backgroundColor: '#171717',
    borderColor: '#171717',
  },
  labelSelected: {
    color: '#FFFFFF',
  },
  checkBadge: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FACC15',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
