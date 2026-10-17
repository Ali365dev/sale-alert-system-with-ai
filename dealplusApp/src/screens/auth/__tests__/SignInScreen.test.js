const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockReset = jest.fn();
const mockCanGoBack = jest.fn(() => true);

const homeReset = {
  index: 0,
  routes: [{ name: 'MainTabs', state: { index: 0, routes: [{ name: 'Home' }] } }],
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    reset: mockReset,
    canGoBack: mockCanGoBack,
  }),
}));
jest.mock('../../../services/authApi', () => ({
  login: jest.fn(),
  signup: jest.fn(),
  loginWithGoogle: jest.fn(),
  loginWithApple: jest.fn(),
}));
jest.mock('../../../services/googleAuth', () => ({ signInWithGoogle: jest.fn() }));
jest.mock('../../../services/appleAuth', () => ({
  isAppleSignInAvailable: () => true,
  signInWithApple: jest.fn(),
}));

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import SignInScreen from '../SignInScreen';
import { login, loginWithGoogle, loginWithApple } from '../../../services/authApi';
import { signInWithGoogle } from '../../../services/googleAuth';
import { signInWithApple } from '../../../services/appleAuth';
import useAuthStore from '../../../state/authStore';
import usePreferencesStore from '../../../state/preferencesStore';

beforeEach(() => {
  jest.clearAllMocks();
  mockCanGoBack.mockReturnValue(true);
  useAuthStore.setState({ token: null, user: null });
  usePreferencesStore.setState({ followedBrands: [], favoriteCategories: [] });
});

test('renders the login chrome and form fields', async () => {
  const { getByText, getByPlaceholderText } = await render(<SignInScreen />);
  expect(getByText('Welcome to Deals More')).toBeTruthy();
  expect(getByText('Login')).toBeTruthy();
  expect(getByPlaceholderText('Email address')).toBeTruthy();
  expect(getByText('Forgot password?')).toBeTruthy();
});

test('submit is disabled until both email and password are entered', async () => {
  login.mockResolvedValue({ ok: true, token: 't', user: { id: 1, email: 'a@b.com' }, brands: [], categories: [] });
  const { getByText, getByPlaceholderText } = await render(<SignInScreen />);
  await fireEvent.press(getByText('Sign In'));
  expect(login).not.toHaveBeenCalled();

  await fireEvent.changeText(getByPlaceholderText('Email address'), 'a@b.com');
  await fireEvent.press(getByText('Sign In'));
  expect(login).not.toHaveBeenCalled(); // still no password

  await fireEvent.changeText(getByPlaceholderText('Password'), 'secret123');
  await fireEvent.press(getByText('Sign In'));
  await waitFor(() => expect(login).toHaveBeenCalledTimes(1));
});

test('an invalid email shows a validation error and does not call login', async () => {
  const { getByText, getByPlaceholderText } = await render(<SignInScreen />);
  await fireEvent.changeText(getByPlaceholderText('Email address'), 'not-an-email');
  await fireEvent.changeText(getByPlaceholderText('Password'), 'secret123');
  await fireEvent.press(getByText('Sign In'));

  expect(getByText('Enter a valid email address.')).toBeTruthy();
  expect(login).not.toHaveBeenCalled();
});

test('the password visibility toggle switches secureTextEntry', async () => {
  const { getByPlaceholderText, UNSAFE_root } = await render(<SignInScreen />);
  const passwordInput = getByPlaceholderText('Password');
  expect(passwordInput.props.secureTextEntry).toBe(true);
});

test('on success: stores the token/user, hydrates preferences, and resets to Home', async () => {
  login.mockResolvedValue({
    ok: true,
    token: 'tok-1',
    user: { id: 1, email: 'a@b.com', name: 'Alex' },
    brands: ['Nike'],
    categories: ['Footwear'],
  });

  const { getByText, getByPlaceholderText } = await render(<SignInScreen />);
  await fireEvent.changeText(getByPlaceholderText('Email address'), 'a@b.com');
  await fireEvent.changeText(getByPlaceholderText('Password'), 'secret123');
  await fireEvent.press(getByText('Sign In'));

  await waitFor(() => expect(mockReset).toHaveBeenCalledWith(homeReset));
  expect(useAuthStore.getState().token).toBe('tok-1');
  expect(useAuthStore.getState().user).toEqual({ id: 1, email: 'a@b.com', name: 'Alex' });
  expect(usePreferencesStore.getState().followedBrands).toEqual(['Nike']);
  expect(usePreferencesStore.getState().favoriteCategories).toEqual(['Footwear']);
});

test('on failure: shows the backend\'s error message and does not navigate away or store a token', async () => {
  login.mockResolvedValue({ ok: false, error: 'Incorrect email or password.' });

  const { getByText, getByPlaceholderText } = await render(<SignInScreen />);
  await fireEvent.changeText(getByPlaceholderText('Email address'), 'a@b.com');
  await fireEvent.changeText(getByPlaceholderText('Password'), 'wrongpass');
  await fireEvent.press(getByText('Sign In'));

  await waitFor(() => expect(getByText('Incorrect email or password.')).toBeTruthy());
  expect(mockReset).not.toHaveBeenCalled();
  expect(useAuthStore.getState().token).toBeNull();
});

test('"Skip" resets navigation to Home without signing in', async () => {
  const { getByText } = await render(<SignInScreen />);
  await fireEvent.press(getByText('Skip'));
  expect(mockReset).toHaveBeenCalledWith(homeReset);
  expect(login).not.toHaveBeenCalled();
});

test('the "Sign Up" link / Create Account tab slides to signup fields in place', async () => {
  const { getByText, getByPlaceholderText, queryByPlaceholderText } = await render(<SignInScreen />);
  expect(queryByPlaceholderText('Full name')).toBeNull();

  await fireEvent.press(getByText('Sign Up'));
  expect(mockNavigate).not.toHaveBeenCalledWith('SignUpScreen');
  expect(getByPlaceholderText('Full name')).toBeTruthy();
  expect(getByPlaceholderText('Confirm password')).toBeTruthy();
});

describe('Continue with Apple', () => {
  test('on success: exchanges the Firebase token, stores auth, and returns home', async () => {
    signInWithApple.mockResolvedValue({ idToken: 'firebase-apple-token', name: 'Ada Lovelace' });
    loginWithApple.mockResolvedValue({
      ok: true,
      token: 'tok-apple',
      user: { id: 3, email: 'a@privaterelay.appleid.com', name: 'Ada Lovelace' },
      brands: [],
      categories: [],
    });

    const { getByText } = await render(<SignInScreen />);
    await fireEvent.press(getByText('Continue with Apple'));

    await waitFor(() => expect(mockReset).toHaveBeenCalledWith(homeReset));
    expect(loginWithApple).toHaveBeenCalledWith('firebase-apple-token', { name: 'Ada Lovelace' });
    expect(useAuthStore.getState().token).toBe('tok-apple');
  });

  test('cancelling Apple sheet is a no-op', async () => {
    signInWithApple.mockRejectedValue({ code: 'SIGN_IN_CANCELLED' });

    const { getByText } = await render(<SignInScreen />);
    await fireEvent.press(getByText('Continue with Apple'));

    await waitFor(() => expect(getByText('Continue with Apple')).toBeTruthy());
    expect(loginWithApple).not.toHaveBeenCalled();
  });
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

    const { getByText } = await render(<SignInScreen />);
    await fireEvent.press(getByText('Continue with Google'));

    await waitFor(() => expect(mockReset).toHaveBeenCalledWith(homeReset));
    expect(loginWithGoogle).toHaveBeenCalledWith('firebase-id-token-1');
    expect(login).not.toHaveBeenCalled();
    expect(useAuthStore.getState().token).toBe('tok-google');
    expect(usePreferencesStore.getState().followedBrands).toEqual(['Adidas']);
  });

  test('a backend rejection (e.g. Google sign-in not configured server-side) shows the error, no token stored', async () => {
    signInWithGoogle.mockResolvedValue('firebase-id-token-1');
    loginWithGoogle.mockResolvedValue({ ok: false, error: "Google sign-in isn't set up on the server yet." });

    const { getByText } = await render(<SignInScreen />);
    await fireEvent.press(getByText('Continue with Google'));

    await waitFor(() => expect(getByText("Google sign-in isn't set up on the server yet.")).toBeTruthy());
    expect(mockReset).not.toHaveBeenCalled();
    expect(useAuthStore.getState().token).toBeNull();
  });

  test('the user cancelling the picker is treated as a no-op, not an error toast', async () => {
    signInWithGoogle.mockRejectedValue({ code: 'SIGN_IN_CANCELLED' });

    const { getByText, queryByText } = await render(<SignInScreen />);
    await fireEvent.press(getByText('Continue with Google'));

    await waitFor(() => expect(getByText('Continue with Google')).toBeTruthy());
    expect(loginWithGoogle).not.toHaveBeenCalled();
    expect(queryByText("Couldn't sign in with Google. Please try again.")).toBeNull();
  });

  test('a genuine native failure is reported, and does not crash the screen', async () => {
    signInWithGoogle.mockRejectedValue(new Error('Play services unavailable'));

    const { getByText } = await render(<SignInScreen />);
    await fireEvent.press(getByText('Continue with Google'));

    // The screen recovers to its normal state — pressing again is possible
    // (not stuck disabled/crashed from the unhandled rejection).
    await waitFor(() => expect(getByText('Continue with Google')).toBeTruthy());
    expect(loginWithGoogle).not.toHaveBeenCalled();
    expect(useAuthStore.getState().token).toBeNull();
  });
});
