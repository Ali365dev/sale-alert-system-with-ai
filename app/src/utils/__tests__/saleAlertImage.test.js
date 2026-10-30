import { findBrandLogo, resolveSaleAlertImage, resolveSaleAlertImageSources } from '../saleAlertImage';

describe('saleAlertImage', () => {
  const brands = [
    { name: 'Outfitters', logoUrl: 'https://cdn.example/ot.png' },
    { name: 'Breakout', logo_url: 'https://cdn.example/bo.png' },
  ];

  test('findBrandLogo matches case-insensitively', () => {
    expect(findBrandLogo('outfitters', brands)).toBe('https://cdn.example/ot.png');
    expect(findBrandLogo('Breakout', brands)).toBe('https://cdn.example/bo.png');
    expect(findBrandLogo('Missing', brands)).toBeNull();
  });

  test('resolveSaleAlertImage prefers product image over brand logo', () => {
    expect(
      resolveSaleAlertImage(
        { image_url: 'https://cdn.example/product.jpg', brand_name: 'Outfitters' },
        brands,
      ),
    ).toBe('https://cdn.example/product.jpg');
  });

  test('resolveSaleAlertImage falls back to brand logo', () => {
    expect(resolveSaleAlertImage({ brand_name: 'Outfitters' }, brands)).toBe(
      'https://cdn.example/ot.png',
    );
  });

  test('resolveSaleAlertImageSources keeps brand logo as load-failure fallback', () => {
    expect(
      resolveSaleAlertImageSources(
        { image_url: 'http://outfitters.com.pk/cdn/product.jpg', brand_name: 'Outfitters' },
        brands,
      ),
    ).toEqual({
      uri: 'http://outfitters.com.pk/cdn/product.jpg',
      fallbackUri: 'https://cdn.example/ot.png',
    });
  });
});
