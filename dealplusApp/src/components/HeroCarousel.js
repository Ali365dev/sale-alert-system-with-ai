import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import { RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../styles/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SLIDE_WIDTH = SCREEN_WIDTH * 0.82;

const dealHeadline = (deal) => (deal.isPercentageOff ? `${deal.discountLabel.replace('-', '')} OFF` : deal.discountLabel);

const HeroCarousel = ({ deals, brandsById, onPressDeal }) => {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={SLIDE_WIDTH + SPACING.three}
      decelerationRate="fast"
      contentContainerStyle={styles.scrollContent}>
      {deals.map((deal) => {
        const brand = brandsById[deal.brandId];
        return (
          <View key={deal.id} style={[styles.slideShadow, { width: SLIDE_WIDTH }]}>
            <Pressable onPress={() => onPressDeal(deal)} style={styles.slide}>
              <FastImage source={{ uri: deal.image }} style={styles.image} resizeMode={FastImage.resizeMode.cover} />
              <View style={styles.scrim} />

              {brand?.name && (
                <View style={styles.brandBadge}>
                  <Text style={styles.brandBadgeLabel} numberOfLines={1}>
                    {brand.name.toUpperCase()}
                  </Text>
                </View>
              )}

              <View style={styles.content}>
                <Text style={styles.headline} numberOfLines={1}>
                  {dealHeadline(deal)}
                </Text>
                <Text style={styles.description} numberOfLines={2}>
                  {deal.description}
                </Text>
              </View>
            </Pressable>
          </View>
        );
      })}
    </ScrollView>
  );
};

export default HeroCarousel;

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: SPACING.four,
    gap: SPACING.three,
  },
  slideShadow: {
    borderRadius: RADIUS.card,
    ...SHADOWS.raised,
  },
  slide: {
    aspectRatio: 16 / 10,
    borderRadius: RADIUS.card,
    overflow: 'hidden',
    backgroundColor: '#171717',
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(183,19,26,0.55)',
  },
  brandBadge: {
    position: 'absolute',
    top: SPACING.three,
    left: SPACING.three,
    backgroundColor: '#F5CB1B',
    paddingHorizontal: SPACING.two,
    paddingVertical: 4,
    borderRadius: 4,
  },
  brandBadgeLabel: {
    ...TYPOGRAPHY.label,
    color: '#171717',
    fontSize: 11,
  },
  content: {
    position: 'absolute',
    left: SPACING.three,
    right: SPACING.three,
    bottom: SPACING.three,
    gap: 2,
  },
  headline: {
    ...TYPOGRAPHY.title,
    color: '#FFFFFF',
    fontSize: 30,
    lineHeight: 34,
  },
  description: {
    ...TYPOGRAPHY.small,
    color: '#F5E5E5',
  },
});
