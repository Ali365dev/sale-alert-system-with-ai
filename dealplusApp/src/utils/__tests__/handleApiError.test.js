jest.mock('../CustomToast', () => ({ showErrorToast: jest.fn() }));

import { showErrorToast } from '../CustomToast';
import { handleApiError } from '../handleApiError';

beforeEach(() => {
  showErrorToast.mockClear();
});

test('a "Network Error" shows a connectivity-specific message', () => {
  handleApiError({ message: 'Network Error' });
  expect(showErrorToast).toHaveBeenCalledWith('Please check your internet connection.');
});

test('a backend error payload (response.data.error) is shown verbatim', () => {
  handleApiError({ response: { data: { error: 'Brand name is required.' } } });
  expect(showErrorToast).toHaveBeenCalledWith('Brand name is required.');
});

test('a generic JS error falls back to its own message', () => {
  handleApiError({ message: 'Something exploded' });
  expect(showErrorToast).toHaveBeenCalledWith('Something exploded');
});

test('an error with no message and no response falls back to a generic message', () => {
  handleApiError({});
  expect(showErrorToast).toHaveBeenCalledWith('Something went wrong. Please try again.');
});

test('a response.data.error takes priority over a generic error.message', () => {
  handleApiError({ message: 'axios error', response: { data: { error: 'Server-specific reason' } } });
  expect(showErrorToast).toHaveBeenCalledWith('Server-specific reason');
});
