import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import Clipboard from '@react-native-clipboard/clipboard';
import FastImage from '@d11/react-native-fast-image';
import { SHADOWS, TYPOGRAPHY } from '../styles/theme';
import useTheme from '../hooks/useTheme';
import { logoCandidateUris } from './BrandLogo';
import { usePressScale } from '../hooks/usePressScale';
import { showSuccessToast } from '../utils/CustomToast';
import { useEffect, useState } from 'react';

const TILE_COLORS = ['#FFF6DF', '#FFF0F3', '#EEF4FF', '#FDECEF', '#EAF8F1', '#F3F5F8'];

const tileColorFor = (name = '') => {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash + name.charCodeAt(i) * (i + 1)) % TILE_COLORS.length;
  return TILE_COLORS[hash];
};

/** Figma offer row (3:81) — 48px square mark, title, Use code, Copy. */
const DealCard = ({ deal, brand, onPress, style, transitionTag }) => {
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

  const onCopy = () => {
    if (!code) return;
    Clipboard.setString(code);
    showSuccessToast('Code copied');
  };

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
  });
