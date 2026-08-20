// CustomToast.js
import React from 'react';
import Toast, { BaseToast, ErrorToast } from 'react-native-toast-message';
import { StatusBar, StyleSheet } from 'react-native';
import { COLORS, moderateScale } from '../styles/theme';
import Icon from 'react-native-vector-icons/FontAwesome5';

export const toastConfig = {
  success: (props) => (
    <BaseToast
      {...props}
      style={styles.successToast}
      contentContainerStyle={styles.contentContainer}
      text1Style={styles.title}
      text2Style={styles.message}
      text2NumberOfLines={3}
      renderLeadingIcon={() => (
        <Icon name="check-circle" size={24} color={COLORS.primary} style={{ marginLeft: moderateScale(8), marginTop: moderateScale(4) }} />
      )}
    />
  ),
  error: (props) => (
    <ErrorToast
      {...props}
      style={styles.errorToast}
      contentContainerStyle={styles.contentContainer}
      text1Style={styles.title}
      text2Style={styles.message}
      text2NumberOfLines={3}
      renderLeadingIcon={() => (
        <Icon name="exclamation-circle" size={24} color="#ff4444" style={{ marginLeft: moderateScale(8), marginTop: moderateScale(4) }} />
      )}
    />
  ),
};

// Custom toast functions
export const showToast = {
  success: (message, title = 'Success') => {
    Toast.show({
      type: 'success',
      text1: title,
      text2: message,
      position: 'top',
      visibilityTime: 3000,
      topOffset: StatusBar.currentHeight || 80,
    });
  },
  error: (message, title = 'Error') => {
    Toast.show({
      type: 'error',
      text1: title,
      text2: message,
      position: 'top',
      visibilityTime: 4000,
      topOffset: StatusBar.currentHeight || 80,
    });
  },
};

// Show error toast message
export const showErrorToast = (message) => {
  Toast.show({
    type: 'error',
    text1: 'Error',
    text2: message,
    position: 'top',
    visibilityTime: 2000,
    topOffset: StatusBar.currentHeight || 80,
    zIndex: 9999,
  });
};

// Show success toast message
export const showSuccessToast = (message) => {
  Toast.show({
    type: 'success',
    text1: 'Success',
    text2: message,
    position: 'top',
    visibilityTime: 2000,
  });
};

const styles = StyleSheet.create({
  successToast: {
    borderLeftColor: COLORS.primary,
    backgroundColor: COLORS.white,
    borderRadius: 8,
    marginHorizontal: 16,
    height: 'auto',
    minHeight: 60,
    paddingVertical: 12,
    shadowColor: COLORS.white,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  errorToast: {
    borderLeftColor: '#ff4444',
    backgroundColor: COLORS.white,
    borderRadius: 8,
    marginHorizontal: 16,
    height: 'auto',
    minHeight: 60,
    paddingVertical: 12,
    shadowColor: '#ff4444',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 1000,
  },
  contentContainer: {
    paddingHorizontal: moderateScale(8),
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.black,
  },
  message: {
    fontSize: 14,
    color: COLORS.black,
    fontWeight: '400',
    flexWrap: 'wrap',
  },
});
