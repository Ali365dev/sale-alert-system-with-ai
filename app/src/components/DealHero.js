import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import Icon from 'react-native-vector-icons/Ionicons';
import useTheme from '../hooks/useTheme';
import BrandLogo from './BrandLogo';

const HERO_HEIGHT = 230;
// Email artwork is often a thin header strip; cropping it to cover shows nothing useful.
const BANNER_RATIO = 2.2;

/** Cover artwork for a deal: the offer's own image when it has one,
 * otherwise a branded panel — never an unrelated stock photo. */
const DealHero = ({ deal, brand, badge, expiryLabel, expiryUrgent }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [failed, setFailed] = useState(false);
  const [banner, setBanner] = useState(false);
  // Deals cached before `hasOwnImage` existed only carry `image`; the category stock photos all come from Unsplash.
  const ownImage = deal.hasOwnImage ?? !/images\.unsplash\.com/.test(deal.image ?? '');
  const showImage = ownImage && deal.image && !failed;
  const name = brand?.name ?? 'this store';

  return (
    <View style={styles.hero}>
      {showImage ? (
        <FastImage
          source={{ uri: deal.image, priority: FastImage.priority.high }}
          style={[styles.image, banner && styles.imageBanner]}
          resizeMode={banner ? FastImage.resizeMode.contain : FastImage.resizeMode.cover}
          onError={() => setFailed(true)}
          onLoad={({ nativeEvent }) => {
            const { width, height } = nativeEvent ?? {};
            if (width && height && width / height > BANNER_RATIO) setBanner(true);
          }}
          accessible
          accessibilityRole="image"
          accessibilityLabel={`Promotional image from ${name}`}
          testID="deal-hero-image"
        />
      ) : (
        <View style={styles.fallback} testID="deal-hero-fallback">
          <BrandLogo
            initials={brand?.initials ?? '?'}
            logoUrl={brand?.logoUrl}
            website={brand?.website}
            logoScale={brand?.logoScale}
            logoOffsetX={brand?.logoOffsetX}
            logoOffsetY={brand?.logoOffsetY}
            size={88}
            tone="filled"
            elevated
          />
          <Text style={styles.fallbackLabel} numberOfLines={1}>
            {brand?.name ?? deal.category}
          </Text>
        </View>
      )}

      {badge ? (
        <View style={styles.badge}>
          <Icon name="pricetag" size={13} color={colors.onPrimary} />
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
      <View style={[styles.expiry, expiryUrgent && styles.expiryUrgent]}>
        <Icon name="time-outline" size={13} color={expiryUrgent ? colors.black : colors.text} />
        <Text style={[styles.expiryText, expiryUrgent && styles.expiryTextUrgent]}>{expiryLabel}</Text>
      </View>
    </View>
  );
};

export default DealHero;

const pill = {
  position: 'absolute',
  top: 14,
  flexDirection: 'row',
  alignItems: 'center',
  gap: 5,
  paddingHorizontal: 11,
  paddingVertical: 6,
  borderRadius: 999,
};

const createStyles = (colors) =>
  StyleSheet.create({
    hero: {
      height: HERO_HEIGHT,
      borderRadius: 24,
      overflow: 'hidden',
      backgroundColor: colors.backgroundElement,
    },
    image: {
      width: '100%',
      height: '100%',
    },
    imageBanner: {
      backgroundColor: colors.backgroundElement,
    },
    fallback: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      backgroundColor: colors.primarySoft,
    },
    fallbackLabel: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.primary,
      maxWidth: '80%',
    },
    badge: {
      ...pill,
      left: 14,
      backgroundColor: colors.primary,
    },
    badgeText: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.onPrimary,
      letterSpacing: 0.3,
    },
    expiry: {
      ...pill,
      right: 14,
      backgroundColor: colors.surface,
    },
    expiryUrgent: {
      backgroundColor: colors.warning,
    },
    expiryText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
    },
    expiryTextUrgent: {
      color: colors.black,
    },
  });
