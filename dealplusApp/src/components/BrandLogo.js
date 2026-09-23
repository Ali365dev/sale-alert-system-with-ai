import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import useTheme from '../hooks/useTheme';

/** RN paints these without a proxy. SVG/ICO need another source. */
const UNRELIABLE_LOGO = /\.(svg|ico)(\?|$)/i;
const HTTP_URL = /^https?:\/\//i;

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

const encodeLogoUrl = (logo) => {
  try {
    return encodeURIComponent(decodeURI(logo));
  } catch {
    return encodeURIComponent(logo);
  }
};

/**
 * Ordered candidate URIs for a brand mark.
 * 1. Stored logo (any non-SVG/ICO http URL — many CDNs omit extensions)
 * 2. Google favicon for the brand website (reliable for most stores)
 * 3. DuckDuckGo icon
 * 4. Clearbit (last — often returns a blank tile that still "loads")
 * 5. Weserv rasterization for SVG/ICO / odd CDN URLs
 */
export const logoCandidateUris = (logoUrl, website) => {
  const uris = [];
  const logo = (logoUrl || '').trim();
  const host = hostnameFromWebsite(website);
  const unreliable = Boolean(logo && UNRELIABLE_LOGO.test(logo));

  if (logo && HTTP_URL.test(logo) && !unreliable) {
    uris.push(logo);
  }

  if (host) {
    uris.push(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`);
    uris.push(`https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`);
    uris.push(`https://logo.clearbit.com/${encodeURIComponent(host)}`);
  }

  if (logo && unreliable) {
    uris.push(`https://images.weserv.nl/?url=${encodeLogoUrl(logo)}&output=png&w=256`);
  } else if (logo && HTTP_URL.test(logo) && !unreliable) {
    // Extension-less / odd CDN URLs — retry via weserv if direct fetch fails
    uris.push(`https://images.weserv.nl/?url=${encodeLogoUrl(logo)}&output=png&w=256`);
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
  const loadedRef = useRef(false);

  useEffect(() => {
    setIndex(0);
    setGaveUp(false);
    loadedRef.current = false;
  }, [logoUrl, website]);

  useEffect(() => {
    loadedRef.current = false;
  }, [index]);

  const uri = !gaveUp ? candidates[index] ?? null : null;
  const source = useMemo(
    () => (uri ? { uri, priority: FastImage.priority.normal, cache: FastImage.cacheControl.web } : null),
    [uri],
  );

  const disk = { width: size, height: size, borderRadius: plain ? Math.min(12, size * 0.18) : size / 2 };

  const onImageError = () => {
    // Ignore late errors after this URI already painted successfully.
    if (loadedRef.current) return;
    if (index >= candidates.length - 1) {
      setGaveUp(true);
      return;
    }
    setIndex((i) => i + 1);
  };

  const mark = (() => {
    if (source) {
      const imageSize = plain || cover ? size * 0.78 : size * 0.72;
      return (
        <View style={[styles.circle, plain ? styles.plainWrap : cover ? styles.coverWrap : styles.imageWrap, disk]}>
          <FastImage
            source={source}
            onLoad={() => {
              loadedRef.current = true;
            }}
            onError={onImageError}
            style={{ width: imageSize, height: imageSize }}
            resizeMode={cover ? FastImage.resizeMode.cover : FastImage.resizeMode.contain}
          />
        </View>
      );
    }

    return (
      <View style={[styles.circle, plain ? styles.plainWrap : isFilled ? styles.filled : styles.outline, disk]}>
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
    plainWrap: {
      backgroundColor: '#F8F9FB',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
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
