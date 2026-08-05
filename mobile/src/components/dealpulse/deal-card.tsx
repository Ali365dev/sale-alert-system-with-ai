import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useFavorites } from '@/state/favorites';
import { Brand, Deal } from '@/types/dealpulse';

import { SaleBadge } from './sale-badge';
import { usePressScale } from './use-press-scale';

interface Props {
  deal: Deal;
  brand?: Brand;
  onPress?: () => void;
  variant?: 'row' | 'grid';
  style?: ViewStyle;
}

export function DealCard({ deal, brand, onPress, variant = 'row', style }: Props) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  const { isFavorite, toggleFavorite } = useFavorites();
  const favorite = isFavorite(deal.id);

  return (
    <Animated.View style={[animatedStyle, variant === 'grid' && styles.gridWrapper, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={styles.card}>
        <View style={styles.imageWrap}>
          <Image source={{ uri: deal.image }} style={styles.image} contentFit="cover" />
          <View style={styles.badgeRow}>
            <SaleBadge label={deal.discountLabel} />
          </View>
          <Pressable
            hitSlop={8}
            onPress={() => toggleFavorite(deal.id)}
            style={styles.favoriteButton}>
            <Ionicons
              name={favorite ? 'heart' : 'heart-outline'}
              size={18}
              color={favorite ? '#E7000B' : '#171717'}
            />
          </Pressable>
        </View>

        <View style={styles.info}>
          {brand && (
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {brand.name}
            </ThemedText>
          )}
          <ThemedText type="smallBold" numberOfLines={2} style={styles.title}>
            {deal.title}
          </ThemedText>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const CARD_WIDTH = 200;

const styles = StyleSheet.create({
  gridWrapper: {
    width: CARD_WIDTH,
  },
  card: {
    gap: Spacing.two,
  },
  imageWrap: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: Radius.card,
    overflow: 'hidden',
    backgroundColor: '#F5F5F5',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  badgeRow: {
    position: 'absolute',
    top: Spacing.two,
    left: Spacing.two,
  },
  favoriteButton: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    gap: 2,
  },
  title: {
    lineHeight: 18,
  },
});
