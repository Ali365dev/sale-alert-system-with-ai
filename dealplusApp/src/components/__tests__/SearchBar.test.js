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

test('showCamera renders a visual search control', async () => {
  const onPressCamera = jest.fn();
  const { getByLabelText } = await render(
    <SearchBar value="" onChangeText={() => {}} placeholder="Search brands" showCamera onPressCamera={onPressCamera} />,
  );
  await fireEvent.press(getByLabelText('Visual search'));
  expect(onPressCamera).toHaveBeenCalledTimes(1);
});
