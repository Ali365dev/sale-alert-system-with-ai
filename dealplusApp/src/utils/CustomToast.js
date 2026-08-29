// CustomToast.js
import React from 'react';
import Toast, { BaseToast, ErrorToast } from 'react-native-toast-message';
import { StatusBar, StyleSheet } from 'react-native';
import { moderateScale } from '../styles/theme';
import useTheme from '../hooks/useTheme';
import Icon from 'react-native-vector-icons/FontAwesome5';

function SuccessToastWithTheme(props) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  return (
    <BaseToast
      {...props}
      style={styles.successToast}
      contentContainerStyle={styles.contentContainer}
      text1Style={styles.title}
      text2Style={styles.message}
      text2NumberOfLines={3}
      renderLeadingIcon={() => (
        <Icon name="check-circle" size={24} color={colors.primary} style={{ marginLeft: moderateScale(8), marginTop: moderateScale(4) }} />
      )}
    />
  );
}

function ErrorToastWithTheme(props) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  return (
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
  );
}

export const toastConfig = {
  success: (props) => <SuccessToastWithTheme {...props} />,
  error: (props) => <ErrorToastWithTheme {...props} />,
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

const createStyles = (colors) =>
  StyleSheet.create({
    successToast: {
      borderLeftColor: colors.primary,
      backgroundColor: colors.surface,
      borderRadius: 8,
      marginHorizontal: 16,
      height: 'auto',
      minHeight: 60,
      paddingVertical: 12,
      shadowColor: '#FFFFFF',
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
      backgroundColor: colors.surface,
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
      color: colors.text,
    },
    message: {
      fontSize: 14,
      color: colors.text,
      fontWeight: '400',
      flexWrap: 'wrap',
    },
  });
