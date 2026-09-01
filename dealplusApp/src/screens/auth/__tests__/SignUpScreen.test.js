const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockCanGoBack = jest.fn(() => true);

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack, canGoBack: mockCanGoBack }),
}));
jest.mock('../../../services/authApi', () => ({ signup: jest.fn(), loginWithGoogle: jest.fn() }));
jest.mock('../../../services/googleAuth', () => ({ signInWithGoogle: jest.fn() }));

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import SignUpScreen from '../SignUpScreen';
import { signup, loginWithGoogle } from '../../../services/authApi';
import { signInWithGoogle } from '../../../services/googleAuth';
import useAuthStore from '../../../state/authStore';
import usePreferencesStore from '../../../state/preferencesStore';

beforeEach(() => {
  jest.clearAllMocks();
  mockCanGoBack.mockReturnValue(true);
  useAuthStore.setState({ token: null, user: null });
  usePreferencesStore.setState({ followedBrands: [], favoriteCategories: [] });
});

const fillValidForm = async (getByPlaceholderText, getByText, password = 'password123') => {
  await fireEvent.changeText(getByPlaceholderText('Email address'), 'a@b.com');
  await fireEvent.changeText(getByPlaceholderText('Password'), password);
  await fireEvent.changeText(getByPlaceholderText('Confirm password'), password);
  await fireEvent.press(getByText(/I agree to the/));
};

test('renders the Create Your Account headline and tagline', async () => {
  const { getByText } = await render(<SignUpScreen />);
  expect(getByText('Your Account')).toBeTruthy();
  expect(getByText('Join DealPulse and never miss a great deal again.')).toBeTruthy();
});

test('a password shorter than 8 characters shows a validation error and does not submit', async () => {
  const { getByText, getByPlaceholderText } = await render(<SignUpScreen />);
  await fillValidForm(getByPlaceholderText, getByText, 'short');
  await fireEvent.press(getByText('Create Account'));

  expect(getByText('Password must be at least 8 characters.')).toBeTruthy();
  expect(signup).not.toHaveBeenCalled();
});

test('a mismatched confirm-password shows an error and does not submit', async () => {
  const { getByText, getByPlaceholderText } = await render(<SignUpScreen />);
  await fireEvent.changeText(getByPlaceholderText('Email address'), 'a@b.com');
  await fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
  await fireEvent.changeText(getByPlaceholderText('Confirm password'), 'different123');
  await fireEvent.press(getByText(/I agree to the/));
  await fireEvent.press(getByText('Create Account'));

  expect(getByText('Passwords do not match.')).toBeTruthy();
  expect(signup).not.toHaveBeenCalled();
});

test('submitting without agreeing to the terms shows an error and does not submit', async () => {
  const { getByText, getByPlaceholderText } = await render(<SignUpScreen />);
  await fireEvent.changeText(getByPlaceholderText('Email address'), 'a@b.com');
  await fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
  await fireEvent.changeText(getByPlaceholderText('Confirm password'), 'password123');
  await fireEvent.press(getByText('Create Account'));

  expect(getByText('You must agree to the Terms & Conditions and Privacy Policy.')).toBeTruthy();
  expect(signup).not.toHaveBeenCalled();
});

test('tapping "Terms & Conditions" / "Privacy Policy" navigates to those screens, not just toggling the checkbox', async () => {
  const { getByText } = await render(<SignUpScreen />);
  await fireEvent.press(getByText('Terms & Conditions'));
  expect(mockNavigate).toHaveBeenCalledWith('TermsConditionsScreen');

  await fireEvent.press(getByText('Privacy Policy'));
  expect(mockNavigate).toHaveBeenCalledWith('PrivacyPolicyScreen');
});

test('an invalid email shows a validation error and does not submit', async () => {
  const { getByText, getByPlaceholderText } = await render(<SignUpScreen />);
  await fireEvent.changeText(getByPlaceholderText('Email address'), 'nope');
  await fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
  await fireEvent.changeText(getByPlaceholderText('Confirm password'), 'password123');
  await fireEvent.press(getByText(/I agree to the/));
  await fireEvent.press(getByText('Create Account'));

  expect(getByText('Enter a valid email address.')).toBeTruthy();
  expect(signup).not.toHaveBeenCalled();
});

test('the name field is optional — omitted entirely when blank', async () => {
  signup.mockResolvedValue({ ok: true, token: 't', user: { id: 1, email: 'a@b.com' }, brands: [], categories: [] });
  const { getByText, getByPlaceholderText } = await render(<SignUpScreen />);
  await fillValidForm(getByPlaceholderText, getByText);
  await fireEvent.press(getByText('Create Account'));

  await waitFor(() => expect(signup).toHaveBeenCalledTimes(1));
  expect(signup).toHaveBeenCalledWith({ email: 'a@b.com', password: 'password123', name: undefined });
});

test('a provided name is trimmed and included', async () => {
  signup.mockResolvedValue({ ok: true, token: 't', user: { id: 1, email: 'a@b.com' }, brands: [], categories: [] });
  const { getByText, getByPlaceholderText } = await render(<SignUpScreen />);
  await fireEvent.changeText(getByPlaceholderText('Full name'), '  Alex  ');
  await fillValidForm(getByPlaceholderText, getByText);
  await fireEvent.press(getByText('Create Account'));

  await waitFor(() => expect(signup).toHaveBeenCalledWith({ email: 'a@b.com', password: 'password123', name: 'Alex' }));
});

test('on success: stores the token/user, hydrates any adopted guest preferences, and returns to the previous screen', async () => {
  signup.mockResolvedValue({
    ok: true,
    token: 'tok-1',
    user: { id: 1, email: 'a@b.com', name: 'Alex' },
    brands: ['Nike'],
    categories: [],
  });

  const { getByText, getByPlaceholderText } = await render(<SignUpScreen />);
  await fillValidForm(getByPlaceholderText, getByText);
  await fireEvent.press(getByText('Create Account'));

  await waitFor(() => expect(mockGoBack).toHaveBeenCalledTimes(1));
  expect(useAuthStore.getState().token).toBe('tok-1');
  expect(usePreferencesStore.getState().followedBrands).toEqual(['Nike']);
});

test('on failure (e.g. duplicate email): shows the error and does not store a token', async () => {
  signup.mockResolvedValue({ ok: false, error: 'An account with this email already exists.' });

  const { getByText, getByPlaceholderText } = await render(<SignUpScreen />);
  await fillValidForm(getByPlaceholderText, getByText);
  await fireEvent.press(getByText('Create Account'));

  await waitFor(() => expect(getByText('An account with this email already exists.')).toBeTruthy());
  expect(useAuthStore.getState().token).toBeNull();
  expect(mockGoBack).not.toHaveBeenCalled();
});

test('the "Sign In" link navigates to SignInScreen', async () => {
  const { getByText } = await render(<SignUpScreen />);
  await fireEvent.press(getByText('Sign In'));
  expect(mockNavigate).toHaveBeenCalledWith('SignInScreen');
});

test('"Skip" returns to the previous screen without signing up', async () => {
  const { getByText } = await render(<SignUpScreen />);
  await fireEvent.press(getByText('Skip'));
  expect(mockGoBack).toHaveBeenCalledTimes(1);
  expect(signup).not.toHaveBeenCalled();
});

describe('Continue with Google', () => {
  test('on success: exchanges the Firebase token, stores auth, hydrates preferences, and returns', async () => {
    signInWithGoogle.mockResolvedValue('firebase-id-token-1');
    loginWithGoogle.mockResolvedValue({
      ok: true,
      token: 'tok-google',
      user: { id: 2, email: 'g@b.com', name: 'Gia' },
      brands: ['Adidas'],
      categories: [],
    });

    const { getByText } = await render(<SignUpScreen />);
    await fireEvent.press(getByText('Continue with Google'));

    await waitFor(() => expect(mockGoBack).toHaveBeenCalledTimes(1));
    expect(loginWithGoogle).toHaveBeenCalledWith('firebase-id-token-1');
    expect(signup).not.toHaveBeenCalled();
    expect(useAuthStore.getState().token).toBe('tok-google');
    expect(usePreferencesStore.getState().followedBrands).toEqual(['Adidas']);
  });

  test('a backend rejection shows the error, no token stored', async () => {
    signInWithGoogle.mockResolvedValue('firebase-id-token-1');
    loginWithGoogle.mockResolvedValue({ ok: false, error: "Google sign-in isn't set up on the server yet." });

    const { getByText } = await render(<SignUpScreen />);
    await fireEvent.press(getByText('Continue with Google'));

    await waitFor(() => expect(getByText("Google sign-in isn't set up on the server yet.")).toBeTruthy());
    expect(mockGoBack).not.toHaveBeenCalled();
    expect(useAuthStore.getState().token).toBeNull();
  });

  test('the user cancelling the picker is treated as a no-op', async () => {
    signInWithGoogle.mockRejectedValue({ code: 'SIGN_IN_CANCELLED' });

    const { getByText } = await render(<SignUpScreen />);
    await fireEvent.press(getByText('Continue with Google'));

    await waitFor(() => expect(getByText('Continue with Google')).toBeTruthy());
    expect(loginWithGoogle).not.toHaveBeenCalled();
  });
});
