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
  iconVariant?: 'plain' | 'circle';
  fullWidth?: boolean;
}

export function SelectableCard({
  label,
  icon,
  selected,
  onPress,
  iconVariant = 'plain',
  fullWidth,
}: Props) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.97);

  return (
    <Animated.View style={[animatedStyle, fullWidth ? styles.wrapperFull : styles.wrapper]}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[styles.card, selected && styles.cardSelected]}>
        {icon &&
          (iconVariant === 'circle' ? (
            <View style={[styles.iconCircle, selected && styles.iconCircleSelected]}>
              <Ionicons name={icon} size={22} color={selected ? '#FFFFFF' : '#57302D'} />
            </View>
          ) : (
            <Ionicons name={icon} size={26} color={selected ? '#FFFFFF' : '#B7131A'} />
          ))}
        <ThemedText type="smallBold" style={selected ? styles.labelSelected : undefined}>
          {label}
        </ThemedText>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '48%',
    marginBottom: Spacing.three,
  },
  wrapperFull: {
    width: '100%',
    marginBottom: Spacing.three,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: '#F0DADA',
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    gap: Spacing.two,
  },
  cardSelected: {
    backgroundColor: '#B7131A',
    borderColor: '#B7131A',
  },
  labelSelected: {
    color: '#FFFFFF',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleSelected: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
});
