import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import FastImage from '@d11/react-native-fast-image';
import Icon from 'react-native-vector-icons/Ionicons';
import { RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../styles/theme';
import useTheme from '../hooks/useTheme';
import { useCountdown } from '../hooks/useCountdown';
import { usePressScale } from '../hooks/usePressScale';

const dealBadgeLabel = (deal) => (deal.isPercentageOff ? `${deal.discountLabel.replace('-', '')} OFF` : deal.discountLabel);

const ExpiringSoonCard = ({ deal, onPress }) => {
  const countdown = useCountdown(deal.expiresAt);
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.98);
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Animated.View style={[animatedStyle, styles.card]}>
      <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} style={styles.pressable}>
        <FastImage source={{ uri: deal.image }} style={styles.image} resizeMode={FastImage.resizeMode.cover} />
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={2}>
            {deal.title}
          </Text>
          <View style={styles.badge}>
            <Text style={styles.badgeLabel}>{dealBadgeLabel(deal)}</Text>
          </View>
          <View style={styles.timerRow}>
            <Icon name="time-outline" size={14} color={colors.primary} />
            <Text style={styles.timerLabel}>{countdown}</Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
};

export default ExpiringSoonCard;

const createStyles = (colors) =>
  StyleSheet.create({
    card: {
      borderRadius: RADIUS.card,
      ...SHADOWS.card,
    },
    pressable: {
      flexDirection: 'row',
      gap: SPACING.three,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.card,
      padding: SPACING.two,
    },
    image: {
      width: 72,
      height: 72,
      borderRadius: RADIUS.button,
      backgroundColor: colors.inverseSurface,
    },
    body: {
      flex: 1,
      justifyContent: 'center',
      gap: 6,
    },
    title: {
      ...TYPOGRAPHY.smallBold,
      color: colors.text,
    },
    badge: {
      alignSelf: 'flex-start',
      backgroundColor: colors.errorTint,
      paddingHorizontal: SPACING.two,
      paddingVertical: 3,
      borderRadius: RADIUS.chip,
    },
    badgeLabel: {
      ...TYPOGRAPHY.label,
      color: colors.primary,
      fontSize: 11,
    },
    timerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    timerLabel: {
      ...TYPOGRAPHY.small,
      color: colors.primary,
    },
  });
