import React from 'react';
import { Text } from 'react-native';
import { render, act } from '@testing-library/react-native';
import { useCountdown } from '../useCountdown';

const NOW = new Date('2026-01-01T00:00:00.000Z').getTime();

function CountdownProbe({ expiresAt }) {
  const label = useCountdown(expiresAt);
  return <Text>{label}</Text>;
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
});

afterEach(() => {
  jest.useRealTimers();
});

test('an already-past expiry renders as 00:00:00, not a negative time', async () => {
  const { getByText } = await render(<CountdownProbe expiresAt={new Date(NOW - 60_000).toISOString()} />);
  expect(getByText('00:00:00')).toBeTruthy();
});

test('formats a same-day countdown as HH:MM:SS', async () => {
  const expiresAt = new Date(NOW + (2 * 3600 + 5 * 60 + 9) * 1000).toISOString();
  const { getByText } = await render(<CountdownProbe expiresAt={expiresAt} />);
  expect(getByText('02:05:09')).toBeTruthy();
});

test('formats a multi-day countdown with a leading "Nd " prefix', async () => {
  const expiresAt = new Date(NOW + (3 * 86400 + 1 * 3600 + 2 * 60 + 3) * 1000).toISOString();
  const { getByText } = await render(<CountdownProbe expiresAt={expiresAt} />);
  expect(getByText('3d 01:02:03')).toBeTruthy();
});

test('ticks down live as time passes', async () => {
  const expiresAt = new Date(NOW + 10_000).toISOString();
  const { getByText } = await render(<CountdownProbe expiresAt={expiresAt} />);
  expect(getByText('00:00:10')).toBeTruthy();

  await act(async () => {
    jest.advanceTimersByTime(3000);
  });

  expect(getByText('00:00:07')).toBeTruthy();
});
