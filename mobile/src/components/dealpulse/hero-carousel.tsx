import { Dimensions, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Shadow, Spacing } from '@/constants/theme';
import { Brand, Deal } from '@/types/dealpulse';

import { AnimatedImage, dealImageTag } from './animated-image';

interface Props {
  deals: Deal[];
  brandsById: Record<string, Brand>;
  onPressDeal: (deal: Deal) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SLIDE_WIDTH = SCREEN_WIDTH * 0.82;

function dealHeadline(deal: Deal): string {
  return deal.isPercentageOff ? `${deal.discountLabel.replace('-', '')} OFF` : deal.discountLabel;
}

export function HeroCarousel({ deals, brandsById, onPressDeal }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={SLIDE_WIDTH + Spacing.three}
      decelerationRate="fast"
      contentContainerStyle={styles.scrollContent}>
      {deals.map((deal) => {
        const brand = brandsById[deal.brandId];
        return (
          <View key={deal.id} style={[styles.slideShadow, { width: SLIDE_WIDTH }]}>
            <Pressable onPress={() => onPressDeal(deal)} style={styles.slide}>
              <AnimatedImage
                source={{ uri: deal.image }}
                style={styles.image}
                contentFit="cover"
                sharedTransitionTag={dealImageTag(deal.id)}
              />
              <View style={styles.scrim} />

              {brand?.name && (
                <View style={styles.brandBadge}>
                  <ThemedText type="label" style={styles.brandBadgeLabel} numberOfLines={1}>
                    {brand.name.toUpperCase()}
                  </ThemedText>
                </View>
              )}

              <View style={styles.content}>
                <ThemedText type="title" style={styles.headline} numberOfLines={1}>
                  {dealHeadline(deal)}
                </ThemedText>
                <ThemedText type="small" style={styles.description} numberOfLines={2}>
                  {deal.description}
                </ThemedText>
              </View>
            </Pressable>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  slideShadow: {
    borderRadius: Radius.card,
    ...Shadow.raised,
  },
  slide: {
    aspectRatio: 16 / 10,
    borderRadius: Radius.card,
    overflow: 'hidden',
    backgroundColor: '#171717',
  },
  image: {
    ...StyleSheet.absoluteFill,
  },
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(183,19,26,0.55)',
  },
  brandBadge: {
    position: 'absolute',
    top: Spacing.three,
    left: Spacing.three,
    backgroundColor: '#F5CB1B',
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: 4,
  },
  brandBadgeLabel: {
    color: '#171717',
    fontSize: 11,
  },
  content: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    bottom: Spacing.three,
    gap: 2,
  },
  headline: {
    color: '#FFFFFF',
    fontSize: 30,
    lineHeight: 34,
  },
  description: {
    color: '#F5E5E5',
  },
});
