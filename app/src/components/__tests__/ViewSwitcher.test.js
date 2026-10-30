import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import ViewSwitcher from '../ViewSwitcher';

test('list tab is selected by default and switching to grid calls onChange', async () => {
  const onChange = jest.fn();
  const { getByLabelText } = await render(<ViewSwitcher gridView={false} onChange={onChange} />);

  expect(getByLabelText('List view').props.accessibilityState).toEqual({ selected: true });
  expect(getByLabelText('Grid view').props.accessibilityState).toEqual({ selected: false });

  await fireEvent.press(getByLabelText('Grid view'));
  expect(onChange).toHaveBeenCalledWith(true);
});

test('grid tab is selected when gridView is true', async () => {
  const { getByLabelText } = await render(<ViewSwitcher gridView onChange={() => {}} />);
  expect(getByLabelText('Grid view').props.accessibilityState).toEqual({ selected: true });
  expect(getByLabelText('List view').props.accessibilityState).toEqual({ selected: false });
});
