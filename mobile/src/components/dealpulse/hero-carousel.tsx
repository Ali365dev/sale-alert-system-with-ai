import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { Dimensions, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, View } from 'react-native';

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
    const index = Math.round(e.nativeEvent.contentOffset.x / (SLIDE_WIDTH + Spacing.three));
    setActiveIndex(index);
  };

  return (
    <View>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled={false}
        snapToInterval={SLIDE_WIDTH + Spacing.three}
        decelerationRate="fast"
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
              <View style={styles.content}>
                <ThemedText type="small" style={styles.brand}>
                  {brand?.name ?? ''}
                </ThemedText>
                <ThemedText type="title" style={styles.headline} numberOfLines={2}>
                  {deal.title}
                </ThemedText>
                <View style={styles.cta}>
                  <ThemedText type="label" style={styles.ctaLabel}>
                    Shop Now
                  </ThemedText>
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.dots}>
        {deals.map((deal, i) => (
          <View key={deal.id} style={[styles.dot, i === activeIndex && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  slide: {
    aspectRatio: 4 / 5,
    borderRadius: Radius.card,
    overflow: 'hidden',
    backgroundColor: '#171717',
  },
  image: {
    ...StyleSheet.absoluteFill,
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(23,23,23,0.35)',
  },
  content: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: Spacing.four,
    gap: Spacing.two,
  },
  brand: {
    color: '#FACC15',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headline: {
    color: '#FFFFFF',
  },
  cta: {
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.chip,
    marginTop: Spacing.two,
  },
  ctaLabel: {
    color: '#171717',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: Spacing.three,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E5E7EB',
  },
  dotActive: {
    backgroundColor: '#171717',
    width: 18,
  },
});
