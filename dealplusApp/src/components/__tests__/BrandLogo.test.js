import { hostnameFromWebsite, logoCandidateUris, resolvableLogoUri } from '../BrandLogo';

describe('hostnameFromWebsite', () => {
  test('parses absolute and protocol-relative hosts', () => {
    expect(hostnameFromWebsite('https://www.levi.com/US/en_US/')).toBe('levi.com');
    expect(hostnameFromWebsite('pk.sapphireonline.pk')).toBe('pk.sapphireonline.pk');
  });

  test('returns null for empty/invalid', () => {
    expect(hostnameFromWebsite(null)).toBeNull();
    expect(hostnameFromWebsite('')).toBeNull();
    expect(hostnameFromWebsite('not a url')).toBeNull();
  });
});

describe('logoCandidateUris', () => {
  test('prefers a raster logo_url as the first candidate', () => {
    const uris = logoCandidateUris(
      'https://cdn.example/logo.png',
      'https://www.hushpuppies.com.pk',
    );
    expect(uris[0]).toBe('https://cdn.example/logo.png');
    expect(uris[1]).toContain('google.com/s2/favicons');
    expect(uris[1]).toContain('hushpuppies.com.pk');
  });

  test('skips SVG logo_url and uses the website favicon first', () => {
    const uris = logoCandidateUris(
      "https://upload.wikimedia.org/wikipedia/commons/7/7f/Levi%27s_logo.svg",
      'https://www.levi.com/US/en_US/',
    );
    expect(uris[0]).toBe('https://www.google.com/s2/favicons?domain=levi.com&sz=128');
    expect(uris.some((u) => u.includes('images.weserv.nl'))).toBe(true);
  });

  test('ICO alone falls back to favicon then weserv', () => {
    const uris = logoCandidateUris(
      'https://pk.sapphireonline.pk/images/favicon.ico',
      'https://pk.sapphireonline.pk',
    );
    expect(uris[0]).toContain('google.com/s2/favicons');
    expect(uris[0]).toContain('pk.sapphireonline.pk');
  });

  test('null logo and no website yields no candidates (initials fallback)', () => {
    expect(logoCandidateUris(null, null)).toEqual([]);
  });
});

describe('resolvableLogoUri', () => {
  test('returns the first candidate', () => {
    expect(resolvableLogoUri('https://cdn.example/a.png', null)).toBe('https://cdn.example/a.png');
    expect(resolvableLogoUri(null, null)).toBeNull();
  });
});
