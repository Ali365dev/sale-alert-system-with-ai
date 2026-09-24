import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import Clipboard from '@react-native-clipboard/clipboard';
import FastImage from '@d11/react-native-fast-image';
import { SHADOWS, TYPOGRAPHY } from '../styles/theme';
import useTheme from '../hooks/useTheme';
import useFavoritesStore from '../state/favoritesStore';
import { logoCandidateUris } from './BrandLogo';
import BrandLogo from './BrandLogo';
import FavoriteButton from './FavoriteButton';
import { usePressScale } from '../hooks/usePressScale';
import { showSuccessToast } from '../utils/CustomToast';
import { channelTag, formatExpiryShort, formatFlatOffer } from '../utils/dealAdapters';
import { toggleFavoriteDeal } from '../utils/authGate';

const TILE_COLORS = ['#FFF6DF', '#FFF0F3', '#EEF4FF', '#FDECEF', '#EAF8F1', '#F3F5F8'];

const CHANNEL = {
  ONLINE: { bg: '#E8F8F2', dot: '#059669', text: '#059669', label: 'Online' },
  'IN-STORE': { bg: '#FEF3C7', dot: '#D97706', text: '#D97706', label: 'In-Store' },
};

const tileColorFor = (name = '') => {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash + name.charCodeAt(i) * (i + 1)) % TILE_COLORS.length;
  return TILE_COLORS[hash];
};

const ChannelBadge = ({ deal }) => {
  const channel = CHANNEL[channelTag(deal)] || CHANNEL.ONLINE;
  return (
    <View style={[badgeStyles.pill, { backgroundColor: channel.bg }]}>
      <View style={[badgeStyles.dot, { backgroundColor: channel.dot }]} />
      <Text style={[badgeStyles.label, { color: channel.text }]}>{channel.label}</Text>
    </View>
  );
};

const badgeStyles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 15,
  },
});

/** Figma deals-list card (`offer` / `offerGrid`) or the original promo row. */
const DealCard = ({ deal, brand, onPress, style, transitionTag, variant = 'promo' }) => {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.98);
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const code = deal.promoCode;
  const name = brand?.name ?? 'Store';
  const letter = (brand?.initials || name).slice(0, 1).toUpperCase();
  const candidates = useMemo(() => logoCandidateUris(brand?.logoUrl, brand?.website), [brand?.logoUrl, brand?.website]);
  const [logoIndex, setLogoIndex] = useState(0);
  useEffect(() => setLogoIndex(0), [brand?.logoUrl, brand?.website]);
  const logoUri = candidates[logoIndex] ?? null;
  const favorite = useFavoritesStore((state) => state.favoriteIds.includes(deal.id));

  const onCopy = () => {
    if (!code) return;
    Clipboard.setString(code);
    showSuccessToast('Code copied');
  };

  if (variant === 'offer' || variant === 'offerGrid') {
    const grid = variant === 'offerGrid';
    const headline = formatFlatOffer(deal);
    const subtitle = deal.title || deal.description || name;
    return (
      <Animated.View style={[animatedStyle, grid ? styles.offerGridWrap : styles.offerWrap, style]} sharedTransitionTag={transitionTag}>
        <Pressable
          onPress={onPress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          style={[styles.offerCard, grid && styles.offerCardGrid]}
          accessibilityRole="button"
          accessibilityLabel={`${headline}. ${subtitle}`}>
          <View style={[styles.logoBox, grid && styles.logoBoxGrid]}>
            <BrandLogo brand={brand} initials={brand?.initials ?? letter} size={grid ? 40 : 34} shape="plain" fit="contain" tone="outline" />
          </View>

          <View style={[styles.offerBody, grid && styles.offerBodyGrid]}>
            <Text style={styles.offerTitle} numberOfLines={grid ? 2 : 1}>
              {headline}
            </Text>
            <Text style={styles.offerSubtitle} numberOfLines={grid ? 2 : 1}>
              {subtitle}
            </Text>
            <View style={styles.offerMeta}>
              <ChannelBadge deal={deal} />
              <Text style={styles.offerExp} numberOfLines={1}>
                {formatExpiryShort(deal.expiresAt)}
              </Text>
            </View>
          </View>

          <Pressable
            style={styles.heart}
            onPress={() => toggleFavoriteDeal(deal.id)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={favorite ? 'Remove from favorites' : 'Add to favorites'}>
            <FavoriteButton active={favorite} onPress={() => toggleFavoriteDeal(deal.id)} size={20} tint={colors.primary} />
          </Pressable>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[animatedStyle, styles.card, style]} sharedTransitionTag={transitionTag}>
      <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} style={styles.row}>
        <View style={[styles.mark, { backgroundColor: tileColorFor(name) }]}>
          {logoUri ? (
            <FastImage
              source={{ uri: logoUri }}
              onError={() => setLogoIndex((i) => i + 1)}
              style={styles.markImage}
              resizeMode={FastImage.resizeMode.contain}
            />
          ) : (
            <Text style={styles.markLetter}>{letter}</Text>
          )}
        </View>

        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={1}>
            {name} Promo
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {code ? `Use code: ${code}` : deal.title}
          </Text>
        </View>

        <Pressable
          onPress={code ? onCopy : onPress}
          style={styles.copyBtn}
          accessibilityRole="button"
          accessibilityLabel={code ? 'Copy coupon code' : 'View deal'}>
          <Text style={styles.copyLabel}>{code ? 'Copy' : 'View'}</Text>
        </Pressable>
      </Pressable>
    </Animated.View>
  );
};

export default DealCard;

const createStyles = (colors) =>
  StyleSheet.create({
    card: {
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#EEF1F4',
      ...SHADOWS.card,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 17,
      paddingVertical: 17,
      minHeight: 82,
    },
    mark: {
      width: 48,
      height: 48,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    markImage: {
      width: 32,
      height: 32,
    },
    markLetter: {
      fontSize: 20,
      fontWeight: '800',
      color: '#0F172A',
    },
    body: {
      flex: 1,
      marginLeft: 14,
      marginRight: 14,
      gap: 2,
      minWidth: 0,
    },
    title: {
      ...TYPOGRAPHY.smallBold,
      color: '#0F172A',
      fontSize: 15,
      lineHeight: 20,
    },
    subtitle: {
      ...TYPOGRAPHY.small,
      color: '#8E9AA8',
      fontSize: 13,
      lineHeight: 16,
    },
    copyBtn: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
      minWidth: 54,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    copyLabel: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '700',
    },
    offerWrap: {
      width: '100%',
    },
    offerGridWrap: {
      flex: 1,
    },
    offerCard: {
      position: 'relative',
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#F1F4F8',
      padding: 15,
      shadowColor: '#10243A',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 5,
      elevation: 2,
    },
    offerCardGrid: {
      flexDirection: 'column',
      alignItems: 'flex-start',
      paddingTop: 14,
      paddingBottom: 14,
      minHeight: 176,
    },
    logoBox: {
      width: 52,
      height: 52,
      borderRadius: 12,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#F3F4F6',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    logoBoxGrid: {
      width: 44,
      height: 44,
      marginBottom: 10,
    },
    offerBody: {
      flex: 1,
      marginLeft: 14,
      paddingRight: 28,
      minWidth: 0,
      gap: 2,
    },
    offerBodyGrid: {
      marginLeft: 0,
      paddingRight: 0,
      width: '100%',
    },
    offerTitle: {
      fontSize: 14.5,
      lineHeight: 18,
      fontWeight: '700',
      color: colors.text,
    },
    offerSubtitle: {
      fontSize: 11.5,
      lineHeight: 17,
      fontWeight: '400',
      color: '#687787',
    },
    offerMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
      paddingTop: 6,
    },
    offerExp: {
      fontSize: 10.5,
      lineHeight: 16,
      color: '#9CA3AF',
      fontWeight: '400',
    },
    heart: {
      position: 'absolute',
      top: 14,
      right: 14,
    },
  });
