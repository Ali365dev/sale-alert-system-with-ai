const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ProfileScreen from '../ProfileScreen';
import usePreferencesStore from '../../../state/preferencesStore';
import useDataStore from '../../../state/dataStore';
import useAuthStore from '../../../state/authStore';

beforeEach(() => {
  jest.clearAllMocks();
  usePreferencesStore.setState({ favoriteCategories: [], followedBrands: [] });
  useDataStore.setState({ brands: [], deals: [], categories: [], alerts: [] });
  useAuthStore.setState({ user: null });
});

test('shows a Deal Preference row instead of Favorite Categories', async () => {
  const { getByText, queryByText } = await render(<ProfileScreen />);

  expect(getByText('Deal Preference')).toBeTruthy();
  expect(getByText('Pick at least 5 interests')).toBeTruthy();
  expect(queryByText('Favorite Categories')).toBeNull();

  await fireEvent.press(getByText('Deal Preference'));
  expect(mockNavigate).toHaveBeenCalledWith('DealPreferenceScreen');
});
