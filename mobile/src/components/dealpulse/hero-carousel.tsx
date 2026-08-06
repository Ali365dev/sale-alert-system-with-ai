import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { Brand, Deal } from '@/types/dealpulse';

interface Props {
  deals: Deal[];
  brandsById: Record<string, Brand>;
  onPressDeal: (deal: Deal) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SLIDE_WIDTH = SCREEN_WIDTH - Spacing.four * 2;

export function HeroCarousel({ deals, brandsById, onPressDeal }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SLIDE_WIDTH);
    setActiveIndex(index);
  };

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      onScroll={onScroll}
      scrollEventThrottle={16}
      contentContainerStyle={styles.scrollContent}>
      {deals.map((deal) => {
        const brand = brandsById[deal.brandId];
        return (
          <Pressable
            key={deal.id}
            onPress={() => onPressDeal(deal)}
            style={[styles.slide, { width: SLIDE_WIDTH }]}>
            <Image source={{ uri: deal.image }} style={styles.image} contentFit="cover" />
            <View style={styles.scrim} />

            <View style={styles.badgeRow}>
              <View style={styles.yellowBadge}>
                <ThemedText type="label" style={styles.yellowBadgeLabel}>
                  Up to {deal.discountLabel.replace('-', '')} OFF
                </ThemedText>
              </View>
              {deal.isFeatured && (
                <View style={styles.verifiedBadge}>
                  <ThemedText type="label" style={styles.verifiedLabel}>
                    ✓ AI Verified
                  </ThemedText>
                </View>
              )}
            </View>

            <View style={styles.content}>
              <ThemedText type="title" style={styles.brand} numberOfLines={1}>
                {brand?.name ?? ''}
              </ThemedText>
              <ThemedText type="small" style={styles.description} numberOfLines={2}>
                {deal.description}
              </ThemedText>
              <View style={styles.cta}>
                <ThemedText type="label" style={styles.ctaLabel}>
                  Shop Now
                </ThemedText>
              </View>
            </View>

            <View style={styles.dots}>
              {deals.map((d, i) => (
                <View key={d.id} style={[styles.dot, i === activeIndex && styles.dotActive]} />
              ))}
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: Spacing.four,
  },
  slide: {
    aspectRatio: 4 / 3,
    borderRadius: Radius.card,
    overflow: 'hidden',
    backgroundColor: '#171717',
  },
  image: {
    ...StyleSheet.absoluteFill,
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(23,23,23,0.4)',
  },
  badgeRow: {
    position: 'absolute',
    top: Spacing.three,
    left: Spacing.three,
    flexDirection: 'row',
    gap: Spacing.two,
  },
  yellowBadge: {
    backgroundColor: '#F5CB1B',
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: Radius.chip,
  },
  yellowBadgeLabel: {
    color: '#171717',
    fontSize: 11,
  },
  verifiedBadge: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: Radius.chip,
  },
  verifiedLabel: {
    color: '#171717',
    fontSize: 11,
  },
  content: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    bottom: Spacing.three,
    gap: 4,
  },
  brand: {
    color: '#FFFFFF',
  },
  description: {
    color: '#F0F0F0',
  },
  cta: {
    backgroundColor: '#B7131A',
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.chip,
    marginTop: Spacing.two,
  },
  ctaLabel: {
    color: '#FFFFFF',
  },
  dots: {
    position: 'absolute',
    bottom: Spacing.two,
    right: Spacing.three,
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  dotActive: {
    backgroundColor: '#FFFFFF',
    width: 14,
  },
});
