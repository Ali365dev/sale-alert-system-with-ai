import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import FavoriteButton from '../FavoriteButton';

test('exposes an accessible "Add to favorites" label when not active', async () => {
  const { getByLabelText } = await render(<FavoriteButton active={false} onPress={() => {}} />);
  expect(getByLabelText('Add to favorites')).toBeTruthy();
});

test('exposes an accessible "Remove from favorites" label when active', async () => {
  const { getByLabelText } = await render(<FavoriteButton active onPress={() => {}} />);
  expect(getByLabelText('Remove from favorites')).toBeTruthy();
});

test('pressing it calls onPress', async () => {
  const onPress = jest.fn();
  const { getByLabelText } = await render(<FavoriteButton active={false} onPress={onPress} />);
  await fireEvent.press(getByLabelText('Add to favorites'));
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('accessibilityState reflects whether it is currently active/selected', async () => {
  const { getByLabelText, rerender } = await render(<FavoriteButton active={false} onPress={() => {}} />);
  expect(getByLabelText('Add to favorites').props.accessibilityState).toMatchObject({ selected: false });

  await rerender(<FavoriteButton active onPress={() => {}} />);
  expect(getByLabelText('Remove from favorites').props.accessibilityState).toMatchObject({ selected: true });
});
