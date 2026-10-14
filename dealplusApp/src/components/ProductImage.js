import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import Icon from 'react-native-vector-icons/Ionicons';
import useTheme from '../hooks/useTheme';

/** Clean remote product image URLs for RN (Shopify CDN, protocol-relative, etc.). */
export const normalizeProductImageUrl = (raw) => {
  if (!raw || typeof raw !== 'string') return null;
  let url = raw.trim().replace(/&amp;/g, '&');
  if (!url) return null;
  if (url.startsWith('//')) url = `https:${url}`;
  // iOS ATS blocks cleartext HTTP — many Shopify brand CDNs redirect, but
  // FastImage often fails before that. Prefer HTTPS up front.
  if (url.startsWith('http://')) url = `https://${url.slice(7)}`;
  if (!/^https?:\/\//i.test(url)) return null;
  // Shopify srcset often ships width=100 thumbs — always request a displayable size.
  if (/cdn\.shopify\.com/i.test(url)) {
    const base = url.split('?')[0];
    const vMatch = url.match(/[?&]v=([^&]+)/i);
    url = `${base}?width=800${vMatch ? `&v=${vMatch[1]}` : ''}`;
  }
  return url;
};

/**
 * Product / deal thumbnail using FastImage (same stack as DealCard / ExpiringSoon).
 * Falls back to `fallbackUri` (e.g. brand logo) when the primary URI is missing
 * or fails to load, then to a placeholder icon.
 */
const ProductImage = ({
  uri,
  fallbackUri,
  style,
  size = 64,
  icon = 'cube-outline',
  resizeMode = 'cover',
  fallbackResizeMode = 'contain',
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const primary = normalizeProductImageUrl(uri);
  const fallback = normalizeProductImageUrl(fallbackUri);
  const [useFallback, setUseFallback] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setUseFallback(false);
    setFailed(false);
  }, [primary, fallback]);

  const active = useFallback ? fallback : primary || fallback;
  const showingFallback = !!active && (!primary || useFallback) && active === fallback;
  const boxStyle = [{ width: size, height: size, borderRadius: Math.min(16, size * 0.2) }, style];
  const mode = showingFallback ? fallbackResizeMode : resizeMode;

  if (!active || failed) {
    return (
      <View style={[styles.placeholder, boxStyle]}>
        <Icon
          name={showingFallback || (!primary && fallback) ? 'storefront-outline' : icon}
          size={Math.max(18, size * 0.35)}
          color={colors.primary}
        />
      </View>
    );
  }

  return (
    <FastImage
      key={active}
      source={{
        uri: active,
        priority: FastImage.priority.normal,
        cache: FastImage.cacheControl.web,
      }}
      style={[styles.image, boxStyle]}
      resizeMode={
        mode === 'contain' ? FastImage.resizeMode.contain : FastImage.resizeMode.cover
      }
      onError={() => {
        if (!useFallback && fallback && fallback !== active) {
          setUseFallback(true);
          return;
        }
        setFailed(true);
      }}
    />
  );
};

export default ProductImage;

const createStyles = (colors) =>
  StyleSheet.create({
    image: {
      backgroundColor: colors.backgroundElement,
      overflow: 'hidden',
    },
    placeholder: {
      backgroundColor: colors.backgroundElement,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
  });
