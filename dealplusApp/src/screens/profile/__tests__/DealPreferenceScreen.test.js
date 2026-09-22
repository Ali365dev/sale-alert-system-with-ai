const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack }),
}));

jest.mock('../../../services/preferencesApi', () => ({ saveInterests: jest.fn() }));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import DealPreferenceScreen from '../DealPreferenceScreen';
import usePreferencesStore from '../../../state/preferencesStore';
import useDataStore from '../../../state/dataStore';
import { saveInterests } from '../../../services/preferencesApi';

beforeEach(() => {
  jest.clearAllMocks();
  usePreferencesStore.setState({ favoriteCategories: [], followedBrands: [] });
  useDataStore.setState({ categories: [] });
});

test('shows the interests heading and keeps Let’s go disabled until 5 are selected', async () => {
  const { getByText } = await render(<DealPreferenceScreen />);

  expect(getByText(/What have you been/)).toBeTruthy();
  expect(getByText('0 selected')).toBeTruthy();

  await fireEvent.press(getByText("Let's go!"));
  expect(mockGoBack).not.toHaveBeenCalled();

  await fireEvent.press(getByText('Arts & Design'));
  await fireEvent.press(getByText('Tech'));
  await fireEvent.press(getByText('Photography'));
  await fireEvent.press(getByText('Gaming & VR'));
  expect(getByText('4 selected')).toBeTruthy();
  await fireEvent.press(getByText("Let's go!"));
  expect(mockGoBack).not.toHaveBeenCalled();

  await fireEvent.press(getByText('Travel & Flights'));
  expect(getByText('5 selected')).toBeTruthy();
  await fireEvent.press(getByText("Let's go!"));
  expect(mockGoBack).toHaveBeenCalledTimes(1);
  expect(saveInterests).toHaveBeenCalled();
  expect(usePreferencesStore.getState().favoriteCategories).toEqual(
    expect.arrayContaining(['Arts & Design', 'Tech', 'Photography', 'Gaming & VR', 'Travel & Flights']),
  );
});

test('appends extra API categories that are not already in the interest list', async () => {
  useDataStore.setState({ categories: [{ name: 'Outdoor Gear' }, { name: 'Tech' }] });
  const { getByText, queryAllByText } = await render(<DealPreferenceScreen />);

  expect(getByText('Outdoor Gear')).toBeTruthy();
  expect(queryAllByText('Tech')).toHaveLength(1);
});
