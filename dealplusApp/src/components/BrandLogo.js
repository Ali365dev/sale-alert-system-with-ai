import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import useTheme from '../hooks/useTheme';

/** RN paints these without a proxy. SVG/ICO need another source. */
const RASTER_LOGO = /\.(png|jpe?g|webp|gif)(\?|$)/i;
const UNRELIABLE_LOGO = /\.(svg|ico)(\?|$)/i;

/** Hostname for favicon fallback — ignores bad/relative website values. */
export const hostnameFromWebsite = (website) => {
  if (!website || typeof website !== 'string') return null;
  try {
    const withProto = /^https?:\/\//i.test(website) ? website : `https://${website}`;
    const host = new URL(withProto).hostname.replace(/^www\./i, '');
    return host || null;
  } catch {
    return null;
  }
};

/**
 * Ordered candidate URIs for a brand mark.
 * 1. Raster logo_url (png/jpg/webp/gif) as stored
 * 2. Google favicon for the brand website (works when logo is SVG/ICO/missing)
 * Never uses wsrv for SVG — that proxy 404s on many Wikimedia/Demandware URLs.
 */
export const logoCandidateUris = (logoUrl, website) => {
  const uris = [];
  const logo = (logoUrl || '').trim();
  if (logo && RASTER_LOGO.test(logo) && !UNRELIABLE_LOGO.test(logo)) {
    uris.push(logo);
  }
  const host = hostnameFromWebsite(website);
  if (host) {
    uris.push(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`);
  }
  // Last resort: still try rasterizing SVG/ICO via images.weserv.nl (alternate
  // host — wsrv.nl 404s on several of our stored marks).
  if (logo && UNRELIABLE_LOGO.test(logo)) {
    let encoded = logo;
    try {
      encoded = encodeURIComponent(decodeURI(logo));
    } catch {
      encoded = encodeURIComponent(logo);
    }
    uris.push(`https://images.weserv.nl/?url=${encoded}&output=png&w=256`);
  }
  return [...new Set(uris)];
};

/** @deprecated use logoCandidateUris — kept for older tests/call sites */
export const resolvableLogoUri = (logoUrl, website) => logoCandidateUris(logoUrl, website)[0] ?? null;

/** Real logo when available, otherwise website favicon, otherwise initials. */
const BrandLogo = ({ initials, logoUrl, website, size = 56, tone = 'outline' }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isFilled = tone === 'filled';
  const candidates = useMemo(() => logoCandidateUris(logoUrl, website), [logoUrl, website]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [logoUrl, website]);

  const uri = candidates[index] ?? null;

  if (uri) {
    return (
      <View style={[styles.circle, styles.imageWrap, { width: size, height: size, borderRadius: size / 2 }]}>
        <FastImage
          source={{ uri, priority: FastImage.priority.normal }}
          onError={() => setIndex((i) => i + 1)}
          style={{ width: size * 0.72, height: size * 0.72 }}
          resizeMode={FastImage.resizeMode.contain}
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
        {initials || '?'}
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
      backgroundColor: '#171717',
    },
    imageWrap: {
      backgroundColor: '#F3F4F6',
      borderWidth: 1,
      borderColor: colors.border,
    },
  });
