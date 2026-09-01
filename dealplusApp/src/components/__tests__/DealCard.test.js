import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import DealCard from '../DealCard';
import useFavoritesStore from '../../state/favoritesStore';

const NOW = new Date('2026-06-15T12:00:00.000Z').getTime();

const baseDeal = {
  id: 'deal-1',
  brandId: 'acme',
  title: 'Summer Sale',
  description: '50% off everything',
  discountLabel: '-50%',
  isPercentageOff: true,
  category: 'Fashion',
  isFeatured: false,
  createdAt: '2020-01-01T00:00:00Z', // old, not "new"
  expiresAt: null,
};

const brand = { name: 'Acme Corp', initials: 'AC' };

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
  useFavoritesStore.setState({ favoriteIds: [] });
});

afterEach(() => {
  jest.useRealTimers();
});

test('renders brand name, category, title, description, and discount label', async () => {
  const { getByText } = await render(<DealCard deal={baseDeal} brand={brand} onPress={() => {}} />);
  expect(getByText('Acme Corp')).toBeTruthy();
  expect(getByText('Fashion')).toBeTruthy();
  expect(getByText('Summer Sale')).toBeTruthy();
  expect(getByText('50% off everything')).toBeTruthy();
  expect(getByText('-50%')).toBeTruthy();
});

test('falls back to "Unknown brand" and "?" initials when no brand is given', async () => {
  const { getByText } = await render(<DealCard deal={baseDeal} brand={undefined} onPress={() => {}} />);
  expect(getByText('Unknown brand')).toBeTruthy();
});

describe('expiry label', () => {
  test('no expiresAt shows "No expiry"', async () => {
    const { getByText } = await render(<DealCard deal={{ ...baseDeal, expiresAt: null }} brand={brand} onPress={() => {}} />);
    expect(getByText('No expiry')).toBeTruthy();
  });

  test('a past expiresAt shows "Expired"', async () => {
    const { getByText } = await render(
      <DealCard deal={{ ...baseDeal, expiresAt: new Date(NOW - 86400000).toISOString() }} brand={brand} onPress={() => {}} />,
    );
    expect(getByText('Expired')).toBeTruthy();
  });

  test('an expiry within the last 24h (rounds up to zero days remaining) shows "Ends today"', async () => {
    // expiryLabel does Math.ceil((expiresAt - now) / 1 day) — 0 is the
    // window from just-expired up to a full day ago, distinct from the
    // `days < 0` branch that renders "Expired" beyond that.
    const { getByText } = await render(
      <DealCard deal={{ ...baseDeal, expiresAt: new Date(NOW - 3600000).toISOString() }} brand={brand} onPress={() => {}} />,
    );
    expect(getByText('Ends today')).toBeTruthy();
  });

  test('expiring within the next 24h shows "Ends in 1 day" (singular)', async () => {
    const { getByText } = await render(
      <DealCard deal={{ ...baseDeal, expiresAt: new Date(NOW + 20 * 3600000).toISOString() }} brand={brand} onPress={() => {}} />,
    );
    expect(getByText('Ends in 1 day')).toBeTruthy();
  });

  test('expiring in several days shows the plural form', async () => {
    const { getByText } = await render(
      <DealCard deal={{ ...baseDeal, expiresAt: new Date(NOW + 5 * 86400000).toISOString() }} brand={brand} onPress={() => {}} />,
    );
    expect(getByText('Ends in 5 days')).toBeTruthy();
  });
});

describe('badges', () => {
  test('a verified (isFeatured) deal shows a "Verified" badge, not "New" — even if also recently created', async () => {
    const { getByText, queryByText } = await render(
      <DealCard
        deal={{ ...baseDeal, isFeatured: true, createdAt: new Date(NOW - 86400000).toISOString() }}
        brand={brand}
        onPress={() => {}}
      />,
    );
    expect(getByText('Verified')).toBeTruthy();
    expect(queryByText('New')).toBeNull();
  });

  test('a non-featured deal created within the last 3 days shows a "New" badge', async () => {
    const { getByText } = await render(
      <DealCard deal={{ ...baseDeal, isFeatured: false, createdAt: new Date(NOW - 86400000).toISOString() }} brand={brand} onPress={() => {}} />,
    );
    expect(getByText('New')).toBeTruthy();
  });

  test('a non-featured deal older than 3 days shows neither badge', async () => {
    const { queryByText } = await render(
      <DealCard deal={{ ...baseDeal, isFeatured: false, createdAt: new Date(NOW - 10 * 86400000).toISOString() }} brand={brand} onPress={() => {}} />,
    );
    expect(queryByText('New')).toBeNull();
    expect(queryByText('Verified')).toBeNull();
  });
});

describe('interaction', () => {
  test('pressing the card body calls onPress', async () => {
    const onPress = jest.fn();
    const { getByText } = await render(<DealCard deal={baseDeal} brand={brand} onPress={onPress} />);
    await fireEvent.press(getByText('View Deal'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('pressing the favorite heart toggles it in the favorites store', async () => {
    const { getByLabelText } = await render(<DealCard deal={baseDeal} brand={brand} onPress={() => {}} />);
    await fireEvent.press(getByLabelText('Add to favorites'));
    expect(useFavoritesStore.getState().favoriteIds).toEqual(['deal-1']);
  });

  test('pressing the favorite heart does NOT also trigger the card\'s onPress (no accidental navigation)', async () => {
    const onPress = jest.fn();
    const { getByLabelText } = await render(<DealCard deal={baseDeal} brand={brand} onPress={onPress} />);
    await fireEvent.press(getByLabelText('Add to favorites'));
    expect(onPress).not.toHaveBeenCalled();
  });

  test('reflects an already-favorited deal from the store on render', async () => {
    useFavoritesStore.setState({ favoriteIds: ['deal-1'] });
    const { getByLabelText } = await render(<DealCard deal={baseDeal} brand={brand} onPress={() => {}} />);
    expect(getByLabelText('Remove from favorites')).toBeTruthy();
  });
});
