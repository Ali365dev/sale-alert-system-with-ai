import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import Icon from 'react-native-vector-icons/Ionicons';
import { RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../styles/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SLIDE_WIDTH = SCREEN_WIDTH * 0.85;

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
              <View style={styles.textCol}>
                {brand?.name && (
                  <View style={styles.brandBadge}>
                    <Text style={styles.brandBadgeLabel} numberOfLines={1}>
                      {brand.name.toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text style={styles.headline} numberOfLines={2}>
                  {dealHeadline(deal)}
                </Text>
                <Text style={styles.description} numberOfLines={3}>
                  {deal.description}
                </Text>
                <View style={styles.ctaButton}>
                  <Text style={styles.ctaLabel}>View Deal</Text>
                  <Icon name="chevron-forward-circle" size={18} color="#FFFFFF" />
                </View>
              </View>

              <FastImage source={{ uri: deal.image }} style={styles.image} resizeMode={FastImage.resizeMode.cover} />
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
    flexDirection: 'row',
    aspectRatio: 16 / 10,
    borderRadius: RADIUS.card,
    overflow: 'hidden',
    backgroundColor: '#171717',
  },
  textCol: {
    flex: 1,
    padding: SPACING.three,
    justifyContent: 'center',
    gap: SPACING.one,
  },
  brandBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F5CB1B',
    paddingHorizontal: SPACING.two,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: SPACING.one,
  },
  brandBadgeLabel: {
    ...TYPOGRAPHY.label,
    color: '#171717',
    fontSize: 11,
  },
  headline: {
    ...TYPOGRAPHY.title,
    color: '#FFFFFF',
    fontSize: 26,
    lineHeight: 28,
  },
  description: {
    ...TYPOGRAPHY.small,
    color: '#D1D5DB',
    marginTop: 2,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: '#B7131A',
    borderRadius: RADIUS.chip,
    paddingHorizontal: SPACING.three,
    paddingVertical: SPACING.two,
    marginTop: SPACING.two,
  },
  ctaLabel: {
    ...TYPOGRAPHY.label,
    color: '#FFFFFF',
    fontSize: 13,
  },
  image: {
    width: '42%',
    height: '100%',
  },
});
