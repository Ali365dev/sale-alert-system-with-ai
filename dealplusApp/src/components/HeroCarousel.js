import { useMemo } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../styles/theme';
import useTheme from '../hooks/useTheme';
import { formatDiscountDisplay } from '../utils/dealAdapters';
import BrandLogo from './BrandLogo';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SLIDE_WIDTH = SCREEN_WIDTH - SPACING.four * 2;

/** Marketplace promo banners — yellow/teal brand feature cards. */
const HeroCarousel = ({ deals, brandsById, onPressDeal }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const slides = deals.length > 0 ? deals.slice(0, 4) : [null];

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} decelerationRate="fast" contentContainerStyle={styles.scrollContent}>
        {slides.map((deal, index) => {
          const brand = deal ? brandsById[deal.brandId] : null;
          const isYellow = index % 2 === 0;
          return (
            <Pressable
              key={deal?.id ?? `promo-${index}`}
              onPress={() => deal && onPressDeal?.(deal)}
              style={[styles.slide, { width: SLIDE_WIDTH, backgroundColor: isYellow ? colors.bannerYellow : colors.primary }]}>
              <View style={styles.textCol}>
                {brand?.name ? (
                  <View style={styles.brandBadge}>
                    <BrandLogo brand={brand} size={28} tone="filled" />
                    <Text style={[styles.brandName, !isYellow && styles.onPink]} numberOfLines={1}>
                      {brand.name}
                    </Text>
                  </View>
                ) : (
                  <Text style={[styles.brandName, !isYellow && styles.onPink]}>Weekend deals</Text>
                )}
                <Text style={[styles.headline, !isYellow && styles.onPink]} numberOfLines={2}>
                  {deal ? formatDiscountDisplay(deal) : 'Up to 60% OFF'}
                </Text>
                <Text style={[styles.description, !isYellow && styles.onPinkMuted]} numberOfLines={2}>
                  {deal?.title || 'Exclusive coupons for top brands — shop now & save.'}
                </Text>
              </View>
              <View style={[styles.art, isYellow ? styles.artOnYellow : styles.artOnPink]}>
                <Icon name="pricetag" size={32} color={isYellow ? colors.primary : '#FFFFFF'} />
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.dots}>
        {slides.map((deal, index) => (
          <View key={deal?.id ?? `dot-${index}`} style={[styles.dot, index === 0 && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
};

export default HeroCarousel;

const createStyles = (colors) =>
  StyleSheet.create({
    wrap: {
      gap: SPACING.two,
    },
    scrollContent: {
      paddingHorizontal: SPACING.four,
      gap: SPACING.three,
    },
    slide: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 140,
      borderRadius: 18,
      paddingHorizontal: SPACING.four,
      paddingVertical: SPACING.three,
      ...SHADOWS.card,
    },
    textCol: {
      flex: 1,
      gap: 6,
      paddingRight: SPACING.two,
    },
    brandBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    brandName: {
      ...TYPOGRAPHY.smallBold,
      color: colors.text,
      flex: 1,
    },
    headline: {
      ...TYPOGRAPHY.headline,
      color: colors.text,
      fontSize: 26,
    },
    description: {
      ...TYPOGRAPHY.small,
      color: colors.textSecondary,
    },
    onPink: {
      color: '#FFFFFF',
    },
    onPinkMuted: {
      color: 'rgba(255,255,255,0.85)',
    },
    art: {
      width: 72,
      height: 72,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    artOnYellow: {
      backgroundColor: 'rgba(42,196,156,0.14)',
    },
    artOnPink: {
      backgroundColor: 'rgba(255,255,255,0.2)',
    },
    dots: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 6,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.border,
    },
    dotActive: {
      width: 16,
      backgroundColor: colors.primary,
    },
  });
