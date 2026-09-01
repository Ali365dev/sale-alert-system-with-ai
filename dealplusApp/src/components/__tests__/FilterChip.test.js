import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import FilterChip from '../FilterChip';

test('renders its label', async () => {
  const { getByText } = await render(<FilterChip label="Trending" selected={false} onPress={() => {}} />);
  expect(getByText('Trending')).toBeTruthy();
});

test('pressing it calls onPress', async () => {
  const onPress = jest.fn();
  const { getByText } = await render(<FilterChip label="Trending" selected={false} onPress={onPress} />);
  await fireEvent.press(getByText('Trending'));
  expect(onPress).toHaveBeenCalledTimes(1);
});
