import { useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import useTheme from '../hooks/useTheme';

/** Real logo when the brand has one on file (Brands table's `logo_url`,
 * admin-set or AI-discovered), falling back to an initials circle otherwise
 * — or if the image URL fails to load. */
// RN's <Image> can't decode SVG (no native SVG support) — most scraped/manual
// brand logos are .svg, so route those through a rasterizing proxy that
// fetches the source and re-serves it as a PNG.
const resolvableLogoUri = (logoUrl) =>
  /\.svg(\?|$)/i.test(logoUrl) ? `https://wsrv.nl/?url=${encodeURIComponent(logoUrl)}&output=png` : logoUrl;

const BrandLogo = ({ initials, logoUrl, size = 56, tone = 'outline' }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isFilled = tone === 'filled';
  const [failed, setFailed] = useState(false);

  if (logoUrl && !failed) {
    return (
      <View style={[styles.circle, styles.imageWrap, { width: size, height: size, borderRadius: size / 2 }]}>
        <Image
          source={{ uri: resolvableLogoUri(logoUrl) }}
          onError={() => setFailed(true)}
          style={{ width: size * 0.72, height: size * 0.72 }}
          resizeMode="contain"
        />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.circle,
        isFilled ? styles.filled : styles.outline,
        { width: size, height: size, borderRadius: size / 2 },
      ]}>
      <Text
        style={{
          fontSize: size * 0.32,
          lineHeight: size * 0.32 * 1.2,
          fontWeight: '700',
          color: isFilled ? '#FFFFFF' : colors.text,
        }}>
        {initials}
      </Text>
    </View>
  );
};

export default BrandLogo;

const createStyles = (colors) =>
  StyleSheet.create({
    circle: {
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    outline: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filled: {
      // Deliberately theme-invariant — a solid dark accent chip, not tied to
      // the surrounding page background.
      backgroundColor: '#171717',
    },
    imageWrap: {
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: colors.border,
    },
  });
