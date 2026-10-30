import { useEffect, useState } from 'react';
import { getColors } from 'react-native-image-colors';
import { logoCandidateUris } from '../components/BrandLogo';
import { accentFromName, pickAccentFromResult } from '../utils/brandAccent';

/**
 * Samples the brand mark (logo / favicon) and returns a header/CTA accent color.
 * Falls back to a name-based palette, then the theme primary.
 */
const useBrandAccentColor = (brand, fallback = '#F20D38') => {
  const seed = accentFromName(brand?.name, fallback);
  const [accent, setAccent] = useState(seed);

  useEffect(() => {
    let cancelled = false;
    const nextSeed = accentFromName(brand?.name, fallback);
    setAccent(nextSeed);

    const uris = logoCandidateUris(brand?.logoUrl, brand?.website);
    if (uris.length === 0) return undefined;

    (async () => {
      for (const uri of uris) {
        try {
          const result = await getColors(uri, {
            fallback: nextSeed,
            cache: true,
            key: uri,
            quality: 'low',
          });
          if (cancelled) return;
          setAccent(pickAccentFromResult(result, nextSeed));
          return;
        } catch {
          // try next candidate
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [brand?.logoUrl, brand?.website, brand?.name, fallback]);

  return accent;
};

export default useBrandAccentColor;
