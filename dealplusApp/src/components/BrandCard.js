import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Ionicons';
import { RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../styles/theme';
import useTheme from '../hooks/useTheme';
import BrandLogo from './BrandLogo';
import SaleBadge from './SaleBadge';
import { usePressScale } from '../hooks/usePressScale';

const BrandCard = ({ brand, onPress, variant = 'default', badge }) => {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (variant === 'avatar') {
    return (
      <Animated.View style={animatedStyle}>
        <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} style={styles.avatarCard}>
          <BrandLogo initials={brand.initials} size={64} tone="filled" />
          <Text style={styles.avatarName} numberOfLines={1}>
            {brand.name}
          </Text>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={animatedStyle}>
      <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} style={styles.card}>
        <View style={styles.logoWrap}>
          <BrandLogo initials={brand.initials} size={64} tone="filled" />
          {badge && (
            <View style={styles.badgeWrap}>
              <SaleBadge label={badge} tone="red" />
            </View>
          )}
        </View>

        <Text style={styles.name} numberOfLines={1}>
          {brand.name}
        </Text>

        <Text style={styles.dealCount} numberOfLines={1}>
          <Text style={styles.dealCountNumber}>{brand.dealCount}</Text> deals
        </Text>

        <View style={styles.viewDeal}>
          <Text style={styles.viewDealLabel}>View Deal</Text>
          <Icon name="open-outline" size={13} color={colors.primary} />
        </View>
      </Pressable>
    </Animated.View>
  );
};

export default BrandCard;

const CARD_WIDTH = 152;

const createStyles = (colors) =>
  StyleSheet.create({
    card: {
      width: CARD_WIDTH,
      backgroundColor: colors.surface,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.three,
      ...SHADOWS.card,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    },
    logoWrap: {
      position: 'relative',
      marginBottom: SPACING.two,
    },
    badgeWrap: {
      position: 'absolute',
      top: -6,
      left: -8,
    },
    name: {
      ...TYPOGRAPHY.smallBold,
      color: colors.text,
      fontSize: 15,
    },
    dealCount: {
      ...TYPOGRAPHY.small,
      color: colors.textSecondary,
      marginTop: 2,
    },
    dealCountNumber: {
      color: colors.primary,
      fontWeight: '800',
    },
    viewDeal: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: SPACING.two,
    },
    viewDealLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.primary,
    },
    avatarCard: {
      alignContent: 'center',
      justifyContent: 'center',
      alignItems: 'center',
      width: 84,
      gap: SPACING.two,
    },
    avatarName: {
      ...TYPOGRAPHY.smallBold,
      color: colors.text,
      textAlign: 'center',
    },
  });
