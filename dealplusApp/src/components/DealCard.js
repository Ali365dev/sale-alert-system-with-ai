import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Ionicons';
import { RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../styles/theme';
import useFavoritesStore from '../state/favoritesStore';
import BrandLogo from './BrandLogo';
import FavoriteButton from './FavoriteButton';
import SaleBadge from './SaleBadge';
import { usePressScale } from '../hooks/usePressScale';

const expiryLabel = (expiresAt) => {
  if (!expiresAt) return 'No expiry';
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return 'Expired';
  if (days === 0) return 'Ends today';
  if (days === 1) return 'Ends in 1 day';
  return `Ends in ${days} days`;
};

const isNew = (createdAt) => {
  if (!createdAt) return false;
  const days = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
  return days <= 3;
};

const DealCard = ({ deal, brand, onPress, style }) => {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.98);
  const isFavorite = useFavoritesStore((state) => state.isFavorite);
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite);
  const favorite = isFavorite(deal.id);

  return (
    <Animated.View style={[animatedStyle, styles.card, style]}>
      <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
        <View style={styles.header}>
          <BrandLogo initials={brand?.initials ?? '?'} size={45} tone="filled" />
          <View style={styles.headerText}>
            <Text style={styles.brandName} numberOfLines={1}>
              {brand?.name ?? 'Unknown brand'}
            </Text>
            <Text style={styles.category} numberOfLines={1}>
              {deal.category}
            </Text>
          </View>
          <FavoriteButton active={favorite} onPress={() => toggleFavorite(deal.id)} />
        </View>

        <View style={styles.badgeRow}>
          <SaleBadge label={deal.discountLabel} tone={deal.isPercentageOff ? 'yellow' : 'red'} />
          {deal.isFeatured ? (
            <SaleBadge label="Verified" tone="green" icon="checkmark-circle" />
          ) : (
            isNew(deal.createdAt) && <SaleBadge label="New" tone="gray" />
          )}
        </View>

        <Text style={styles.title} numberOfLines={2}>
          {deal.title}
        </Text>
        <Text style={styles.description} numberOfLines={2}>
          {deal.description}
        </Text>

        <View style={styles.metaRow}>
          <Icon name="time-outline" size={14} color="#6B7280" />
          <Text style={styles.metaText}>{expiryLabel(deal.expiresAt)}</Text>
        </View>

        <View style={styles.ctaButton}>
          <Text style={styles.ctaLabel}>View Deal</Text>
          <Icon name="open-outline" size={15} color="#FFFFFF" />
        </View>
      </Pressable>
    </Animated.View>
  );
};

export default DealCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: '#F0DADA',
    padding: SPACING.three,
    gap: SPACING.two,
    ...SHADOWS.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.two,
  },
  headerText: {
    flex: 1,
  },
  brandName: {
    ...TYPOGRAPHY.smallBold,
  },
  category: {
    fontSize: 12,
    color: '#6B7280',
  },
  badgeRow: {
    marginVertical: SPACING.two,
    flexDirection: 'row',
    gap: SPACING.two,
  },
  title: {
    ...TYPOGRAPHY.smallBold,
    marginVertical: SPACING.one,
  },
  description: {
    ...TYPOGRAPHY.small,
    color: '#6B7280',
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginVertical: SPACING.one,
  },
  metaText: {
    ...TYPOGRAPHY.small,
    color: '#6B7280',
  },
  ctaButton: {
    flexDirection: 'row',
    gap: SPACING.two,
    backgroundColor: '#171717',
    borderRadius: RADIUS.button,
    paddingVertical: SPACING.three,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.one,
  },
  ctaLabel: {
    ...TYPOGRAPHY.label,
    color: '#FFFFFF',
  },
});
