const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
let mockRouteParams = {};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({ params: mockRouteParams }),
}));

jest.mock('../../../services/brandRequestApi', () => ({ requestBrand: jest.fn() }));
jest.mock('../../../utils/CustomToast', () => ({ showErrorToast: jest.fn() }));

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import RequestBrandScreen from '../RequestBrandScreen';
import useDataStore from '../../../state/dataStore';
import { requestBrand } from '../../../services/brandRequestApi';
import { showErrorToast } from '../../../utils/CustomToast';

beforeEach(() => {
  jest.clearAllMocks();
  mockRouteParams = {};
  useDataStore.setState({ categories: [{ name: 'Fashion', dealCount: 5, icon: 'tag' }] });
});

test('submit is disabled until a brand name is entered', async () => {
  const { getByText, getByPlaceholderText } = await render(<RequestBrandScreen />);
  const submit = getByText('Submit Request');

  await fireEvent.press(submit);
  expect(requestBrand).not.toHaveBeenCalled();

  await fireEvent.changeText(getByPlaceholderText('e.g., Acme Corp'), 'Acme');
  await fireEvent.press(getByText('Submit Request'));
  await waitFor(() => expect(requestBrand).toHaveBeenCalledTimes(1));
});

test('a brand name shorter than 2 characters shows a validation error and does not submit', async () => {
  const { getByText, getByPlaceholderText } = await render(<RequestBrandScreen />);
  await fireEvent.changeText(getByPlaceholderText('e.g., Acme Corp'), 'A');
  await fireEvent.press(getByText('Submit Request'));

  expect(getByText('Brand name must be at least 2 characters.')).toBeTruthy();
  expect(requestBrand).not.toHaveBeenCalled();
});

test('an invalid website is rejected while a valid one is accepted', async () => {
  const { getByText, getByPlaceholderText } = await render(<RequestBrandScreen />);
  await fireEvent.changeText(getByPlaceholderText('e.g., Acme Corp'), 'Acme');
  await fireEvent.changeText(getByPlaceholderText('https://www.example.com'), 'not a url');
  await fireEvent.press(getByText('Submit Request'));

  expect(getByText('Enter a valid website, e.g. https://example.com')).toBeTruthy();
  expect(requestBrand).not.toHaveBeenCalled();
});

test('an empty website is fine — it is optional', async () => {
  requestBrand.mockResolvedValue(true);
  const { getByText, getByPlaceholderText, queryByText } = await render(<RequestBrandScreen />);
  await fireEvent.changeText(getByPlaceholderText('e.g., Acme Corp'), 'Acme');
  await fireEvent.press(getByText('Submit Request'));

  await waitFor(() => expect(requestBrand).toHaveBeenCalledTimes(1));
  expect(queryByText('Enter a valid website, e.g. https://example.com')).toBeNull();
});

test('editing a field after a validation error clears just that field\'s error', async () => {
  const { getByText, getByPlaceholderText, queryByText } = await render(<RequestBrandScreen />);
  await fireEvent.changeText(getByPlaceholderText('e.g., Acme Corp'), 'A');
  await fireEvent.press(getByText('Submit Request'));
  expect(getByText('Brand name must be at least 2 characters.')).toBeTruthy();

  await fireEvent.changeText(getByPlaceholderText('e.g., Acme Corp'), 'Acme Inc');
  expect(queryByText('Brand name must be at least 2 characters.')).toBeNull();
});

test('on successful submit, calls requestBrand with the trimmed name and shows the success screen', async () => {
  requestBrand.mockResolvedValue(true);
  const { getByText, getByPlaceholderText } = await render(<RequestBrandScreen />);
  await fireEvent.changeText(getByPlaceholderText('e.g., Acme Corp'), '  Acme Corp  ');
  await fireEvent.press(getByText('Submit Request'));

  await waitFor(() => expect(getByText('Request Received!')).toBeTruthy());
  expect(requestBrand).toHaveBeenCalledWith(expect.objectContaining({ brandName: 'Acme Corp' }));
});

test('combines an optional website and note into a single note field for the API', async () => {
  requestBrand.mockResolvedValue(true);
  const { getByText, getByPlaceholderText } = await render(<RequestBrandScreen />);
  await fireEvent.changeText(getByPlaceholderText('e.g., Acme Corp'), 'Acme');
  await fireEvent.changeText(getByPlaceholderText('https://www.example.com'), 'https://acme.com');
  await fireEvent.changeText(getByPlaceholderText('Why do you want to see deals from this brand?'), 'Love their shoes');
  await fireEvent.press(getByText('Submit Request'));

  await waitFor(() => expect(requestBrand).toHaveBeenCalledTimes(1));
  expect(requestBrand.mock.calls[0][0].note).toBe('Website: https://acme.com\nLove their shoes');
});

test('on failed submit, shows an error toast and stays on the form (no success screen)', async () => {
  requestBrand.mockResolvedValue(false);
  const { getByText, getByPlaceholderText, queryByText } = await render(<RequestBrandScreen />);
  await fireEvent.changeText(getByPlaceholderText('e.g., Acme Corp'), 'Acme');
  await fireEvent.press(getByText('Submit Request'));

  await waitFor(() => expect(showErrorToast).toHaveBeenCalledWith("Couldn't send your request. Please check your connection and try again."));
  expect(queryByText('Request Received!')).toBeNull();
});

test('pre-fills the brand name from route params (e.g. arriving from a "no results" search)', async () => {
  mockRouteParams = { brandName: 'Prefilled Brand' };
  const { getByDisplayValue } = await render(<RequestBrandScreen />);
  expect(getByDisplayValue('Prefilled Brand')).toBeTruthy();
});

test('"Back to Home" from the success screen navigates into the home tab', async () => {
  requestBrand.mockResolvedValue(true);
  const { getByText, getByPlaceholderText } = await render(<RequestBrandScreen />);
  await fireEvent.changeText(getByPlaceholderText('e.g., Acme Corp'), 'Acme');
  await fireEvent.press(getByText('Submit Request'));
  await waitFor(() => expect(getByText('Request Received!')).toBeTruthy());

  await fireEvent.press(getByText('Back to Home'));
  expect(mockNavigate).toHaveBeenCalledWith('MainTabs', { screen: 'Tabs', params: { screen: 'Home' } });
});

test('"Request Another Brand" resets the form back to empty', async () => {
  requestBrand.mockResolvedValue(true);
  const { getByText, getByPlaceholderText } = await render(<RequestBrandScreen />);
  await fireEvent.changeText(getByPlaceholderText('e.g., Acme Corp'), 'Acme');
  await fireEvent.press(getByText('Submit Request'));
  await waitFor(() => expect(getByText('Request Received!')).toBeTruthy());

  await fireEvent.press(getByText('Request Another Brand'));
  expect(getByPlaceholderText('e.g., Acme Corp').props.value).toBe('');
});
