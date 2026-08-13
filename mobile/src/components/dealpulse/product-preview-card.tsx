import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';

import { BrandLogo } from './brand-logo';

interface Props {
  image?: string | null;
  name: string;
  brandName: string;
  currentPrice?: number | null;
  originalPrice?: number | null;
}

export function ProductPreviewCard({ image, name, brandName, currentPrice, originalPrice }: Props) {
  return (
    <View style={styles.card}>
      {image ? (
        <Image source={{ uri: image }} style={styles.image} contentFit="cover" />
      ) : (
        <BrandLogo initials={brandName.slice(0, 2).toUpperCase()} size={56} tone="filled" />
      )}
      <View style={styles.textBlock}>
        <ThemedText type="label" themeColor="textSecondary">
          PRODUCT
        </ThemedText>
        <ThemedText type="smallBold" numberOfLines={1}>
          {name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {brandName}
        </ThemedText>
      </View>
      {(currentPrice != null || originalPrice != null) && (
        <View style={styles.priceBlock}>
          {currentPrice != null && (
            <ThemedText type="smallBold" style={styles.currentPrice}>
              ${currentPrice.toFixed(2)}
            </ThemedText>
          )}
          {originalPrice != null && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.originalPrice}>
              ${originalPrice.toFixed(2)}
            </ThemedText>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: '#F8F9FB',
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: '#F0DADA',
    padding: Spacing.three,
  },
  image: {
    width: 56,
    height: 56,
    borderRadius: Radius.button,
    backgroundColor: '#EDEDED',
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  priceBlock: {
    alignItems: 'flex-end',
  },
  currentPrice: {
    color: '#B7131A',
  },
  originalPrice: {
    textDecorationLine: 'line-through',
  },
});
