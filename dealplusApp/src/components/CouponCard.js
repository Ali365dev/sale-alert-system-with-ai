import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import useTheme from '../hooks/useTheme';
import BrandLogo from './BrandLogo';
import { formatDiscountPercent } from '../utils/dealAdapters';
import { showSuccessToast } from '../utils/CustomToast';

const NOTCH = 20;
const DASH_COUNT_H = 12;
const DASH_COUNT_V = 7;

/** Vertical dashed perforations (ticket edge between left / right). */
function VerticalDash({ color }) {
  return (
    <View style={dashStyles.verticalTrack} pointerEvents="none">
      {Array.from({ length: DASH_COUNT_V }).map((_, i) => (
        <View key={i} style={[dashStyles.verticalDot, { backgroundColor: color }]} />
      ))}
    </View>
  );
}

/** Horizontal dashed perforations (ticket edge between top / bottom). */
function HorizontalDash({ color }) {
  return (
    <View style={dashStyles.horizontalTrack} pointerEvents="none">
      {Array.from({ length: DASH_COUNT_H }).map((_, i) => (
        <View key={i} style={[dashStyles.horizontalDot, { backgroundColor: color }]} />
      ))}
    </View>
  );
}

/**
 * Ticket coupon card.
 * - `horizontal` — list row with Copy
 * - `vertical` — grid cell with side notches (screenshot ticket)
 */
const CouponCard = ({ deal, brand, variant = 'horizontal', onPress, style }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const name = brand?.name || 'Store';
  const code = deal?.promoCode;
  const percent = formatDiscountPercent(deal);
  const isPercent = /%/.test(percent);
  const description =
    brand?.description || deal?.title || `${brand?.dealCount || 0} deals available`;
  const dashColor = colors.textSecondary;

  const onCopy = () => {
    if (!code) {
      onPress?.();
      return;
    }
    Clipboard.setString(code);
    showSuccessToast('Code copied');
  };

  if (variant === 'vertical') {
    return (
      <Pressable
        style={[styles.vCard, style]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${name} ${percent} discount`}>
        <View style={styles.vTop}>
          <BrandLogo brand={brand} size={68} tone="filled" fit="cover" elevated />
          <Text style={styles.vName} numberOfLines={1}>
            {name}
          </Text>
        </View>

        <View style={styles.perforation}>
          <View style={[styles.notch, styles.notchLeft, { backgroundColor: colors.background }]} />
          <HorizontalDash color={dashColor} />
          <View style={[styles.notch, styles.notchRight, { backgroundColor: colors.background }]} />
        </View>

        <View style={styles.vBottom}>
          <Text style={[styles.vPercent, !isPercent && styles.vTypeLabel]} numberOfLines={1}>
            {percent}
          </Text>
          <View style={styles.vBadge}>
            <MaterialCommunityIcons name="ticket-percent-outline" size={14} color={colors.primary} />
            <Text style={styles.vBadgeText}>Discount</Text>
          </View>
          <Text style={styles.vDesc} numberOfLines={2}>
            {description}
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      style={[styles.hCard, style]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name} ${percent} discount`}>
      <View style={styles.hLeft}>
        <BrandLogo brand={brand} size={52} tone="filled" fit="cover" elevated />
        <Text style={styles.hBrandName} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.hDesc} numberOfLines={2}>
          {description}
        </Text>
      </View>

      <View style={styles.hPerforation}>
        <View style={[styles.notch, styles.hNotchTop, { backgroundColor: colors.background }]} />
        <VerticalDash color={dashColor} />
        <View style={[styles.notch, styles.hNotchBottom, { backgroundColor: colors.background }]} />
      </View>

      <View style={styles.hRight}>
        <Text style={[styles.hPercent, !isPercent && styles.hTypeLabel]} numberOfLines={2}>
          {percent}
        </Text>
        <View style={styles.hBadge}>
          <MaterialCommunityIcons name="ticket-percent-outline" size={14} color={colors.primary} />
          <Text style={styles.hBadgeText}>Discount</Text>
        </View>
        <Pressable
          style={styles.copyBtn}
          onPress={onCopy}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={code ? 'Copy coupon code' : 'View coupon'}>
          <Text style={styles.copyLabel}>{code ? 'Copy' : 'View'}</Text>
          <Icon name="copy-outline" size={15} color="#FFFFFF" />
        </Pressable>
      </View>
    </Pressable>
  );
};

export default CouponCard;

const dashStyles = StyleSheet.create({
  verticalTrack: {
    flex: 1,
    width: 2,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    marginVertical: 26,
  },
  verticalDot: {
    width: 2,
    height: 4,
    borderRadius: 1,
    opacity: 0.45,
  },
  horizontalTrack: {
    flex: 1,
    height: 1,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    marginHorizontal: 6,
  },
  horizontalDot: {
    width: 5,
    height: 1.5,
    borderRadius: 1,
    opacity: 0.55,
  },
});

const createStyles = (colors) =>
  StyleSheet.create({
    hCard: {
      flexDirection: 'row',
      alignItems: 'stretch',
      backgroundColor: colors.surface,
      borderRadius: 24,
      minHeight: 148,
      overflow: 'visible',
    },
    hLeft: {
      flex: 1,
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 20,
      paddingLeft: 18,
      paddingRight: 8,
      minWidth: 0,
      overflow: 'visible',
    },
    hBrandName: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.text,
    },
    hDesc: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.mutedInk,
    },
    hPerforation: {
      width: NOTCH,
      alignSelf: 'stretch',
      alignItems: 'center',
      overflow: 'visible',
    },
    hNotchTop: {
      top: -NOTCH / 2,
      left: 0,
    },
    hNotchBottom: {
      bottom: -NOTCH / 2,
      left: 0,
    },
    hRight: {
      width: 128,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingVertical: 16,
      paddingRight: 16,
      paddingLeft: 6,
    },
    hPercent: {
      fontSize: 28,
      lineHeight: 34,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.4,
      textAlign: 'center',
    },
    hTypeLabel: {
      fontSize: 13,
      lineHeight: 16,
      letterSpacing: 0.2,
    },
    hBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.primarySoft,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    hBadgeText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.primary,
    },
    copyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.primary,
      borderRadius: 999,
      paddingHorizontal: 18,
      paddingVertical: 8,
      marginTop: 2,
    },
    copyLabel: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '700',
    },
    vCard: {
      width: '100%',
      backgroundColor: colors.surface,
      borderRadius: 22,
      paddingTop: 22,
      paddingBottom: 18,
      alignItems: 'center',
      overflow: 'visible',
    },
    vTop: {
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 12,
      paddingBottom: 18,
      width: '100%',
    },
    vName: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'center',
    },
    perforation: {
      width: '100%',
      height: NOTCH,
      flexDirection: 'row',
      alignItems: 'center',
      overflow: 'visible',
    },
    notch: {
      position: 'absolute',
      width: NOTCH,
      height: NOTCH,
      borderRadius: NOTCH / 2,
      zIndex: 2,
    },
    notchLeft: {
      left: -NOTCH / 2,
    },
    notchRight: {
      right: -NOTCH / 2,
    },
    vBottom: {
      alignItems: 'center',
      gap: 10,
      paddingTop: 16,
      paddingHorizontal: 14,
      width: '100%',
    },
    vPercent: {
      fontSize: 32,
      lineHeight: 38,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.6,
      textAlign: 'center',
    },
    vTypeLabel: {
      fontSize: 14,
      lineHeight: 18,
      letterSpacing: 0.3,
    },
    vBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.primarySoft,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    vBadgeText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.primary,
    },
    vDesc: {
      fontSize: 12,
      lineHeight: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      paddingHorizontal: 4,
      marginTop: 2,
    },
  });
