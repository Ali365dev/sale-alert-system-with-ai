import React from 'react';
import { Text } from 'react-native';
import { LayoutAnimation } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { Pressable } from 'react-native';
import useViewMode from '../useViewMode';

jest.spyOn(LayoutAnimation, 'configureNext').mockImplementation(() => {});

function Probe() {
  const [gridView, setGridView] = useViewMode(false);
  return (
    <Pressable accessibilityLabel="toggle" onPress={() => setGridView(!gridView)}>
      <Text>{gridView ? 'grid' : 'list'}</Text>
    </Pressable>
  );
}

test('starts in list mode and toggles to grid with a layout animation', async () => {
  const { getByText, getByLabelText } = await render(<Probe />);
  expect(getByText('list')).toBeTruthy();

  await fireEvent.press(getByLabelText('toggle'));
  expect(getByText('grid')).toBeTruthy();
  expect(LayoutAnimation.configureNext).toHaveBeenCalled();
});
