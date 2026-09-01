import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import SearchBar from '../SearchBar';

test('renders the given value and placeholder', async () => {
  const { getByDisplayValue, getByPlaceholderText } = await render(
    <SearchBar value="nike" onChangeText={() => {}} placeholder="Search brands" />,
  );
  expect(getByDisplayValue('nike')).toBeTruthy();
  expect(getByPlaceholderText('Search brands')).toBeTruthy();
});

test('typing calls onChangeText with the new text', async () => {
  const onChangeText = jest.fn();
  const { getByPlaceholderText } = await render(<SearchBar value="" onChangeText={onChangeText} placeholder="Search brands" />);
  await fireEvent.changeText(getByPlaceholderText('Search brands'), 'acme');
  expect(onChangeText).toHaveBeenCalledWith('acme');
});

test('submitting the input calls onSubmitEditing', async () => {
  const onSubmitEditing = jest.fn();
  const { getByPlaceholderText } = await render(
    <SearchBar value="acme" onChangeText={() => {}} placeholder="Search brands" onSubmitEditing={onSubmitEditing} />,
  );
  await fireEvent(getByPlaceholderText('Search brands'), 'submitEditing');
  expect(onSubmitEditing).toHaveBeenCalledTimes(1);
});
