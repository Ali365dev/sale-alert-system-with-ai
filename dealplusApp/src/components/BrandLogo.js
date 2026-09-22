import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
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

/** Real logo when available, otherwise website favicon, otherwise initials.
 * `shape="plain"` skips the circular crop — used for directory / grid tiles. */
const BrandLogo = ({ initials, logoUrl, website, size = 56, tone = 'outline', fit = 'contain', elevated = false, shape = 'circle' }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isFilled = tone === 'filled';
  const cover = fit === 'cover';
  const plain = shape === 'plain';
  const candidates = useMemo(() => logoCandidateUris(logoUrl, website), [logoUrl, website]);
  const [index, setIndex] = useState(0);
  const [gaveUp, setGaveUp] = useState(false);
  const settledRef = useRef(false);

  useEffect(() => {
    setIndex(0);
    setGaveUp(false);
    settledRef.current = false;
  }, [logoUrl, website]);

  const uri = !gaveUp ? candidates[index] ?? null : null;
  const source = useMemo(
    () => (uri ? { uri, priority: FastImage.priority.normal, cache: FastImage.cacheControl.web } : null),
    [uri],
  );

  useEffect(() => {
    settledRef.current = false;
    if (!uri) return undefined;
    const timer = setTimeout(() => {
      settledRef.current = true;
    }, 250);
    return () => clearTimeout(timer);
  }, [uri]);

  const disk = { width: size, height: size, borderRadius: plain ? 0 : size / 2 };

  const mark = (() => {
    if (source) {
      const imageSize = plain || cover ? size : size * 0.72;
      return (
        <View style={[styles.circle, !plain && (cover ? styles.coverWrap : styles.imageWrap), disk]}>
          <FastImage
            source={source}
            onLoad={() => {
              settledRef.current = true;
            }}
            onError={() => {
              if (settledRef.current) return;
              if (index >= candidates.length - 1) {
                setGaveUp(true);
                return;
              }
              setIndex((i) => i + 1);
            }}
            style={{ width: imageSize, height: imageSize }}
            resizeMode={cover ? FastImage.resizeMode.cover : FastImage.resizeMode.contain}
          />
        </View>
      );
    }

    return (
      <View style={[styles.circle, !plain && (isFilled ? styles.filled : styles.outline), disk]}>
        <Text
          style={{
            fontSize: size * 0.32,
            lineHeight: size * 0.32 * 1.2,
            fontWeight: '700',
            color: isFilled && !plain ? '#FFFFFF' : colors.text,
          }}>
          {initials || '?'}
        </Text>
      </View>
    );
  })();

  if (!elevated) return mark;

  return <View style={[styles.lift, disk]}>{mark}</View>;
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
      backgroundColor: '#10233F',
    },
    imageWrap: {
      backgroundColor: '#F3F4F6',
      borderWidth: 1,
      borderColor: colors.border,
    },
    coverWrap: {
      backgroundColor: '#F3F4F6',
    },
    lift: Platform.select({
      ios: {
        shadowColor: '#10233F',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        backgroundColor: '#FFFFFF',
      },
      default: {
        elevation: 8,
        backgroundColor: '#FFFFFF',
        shadowColor: '#10233F',
      },
    }),
  });
