import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import PrimaryButton from '../PrimaryButton';

test('renders its label', async () => {
  const { getByText } = await render(<PrimaryButton label="Submit Request" onPress={() => {}} />);
  expect(getByText('Submit Request')).toBeTruthy();
});

test('pressing it calls onPress', async () => {
  const onPress = jest.fn();
  const { getByText } = await render(<PrimaryButton label="Submit" onPress={onPress} />);
  await fireEvent.press(getByText('Submit'));
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('when disabled, pressing it does not call onPress', async () => {
  const onPress = jest.fn();
  const { getByText } = await render(<PrimaryButton label="Submit" onPress={onPress} disabled />);
  await fireEvent.press(getByText('Submit'));
  expect(onPress).not.toHaveBeenCalled();
});
