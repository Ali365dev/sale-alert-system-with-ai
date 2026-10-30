// CustomToast.js
import React from 'react';
import Toast, { BaseToast, ErrorToast } from 'react-native-toast-message';
import { Image, Platform, StatusBar, StyleSheet, View } from 'react-native';
import { initialWindowMetrics } from 'react-native-safe-area-context';
import { moderateScale } from '../styles/theme';
import useTheme from '../hooks/useTheme';
import Icon from 'react-native-vector-icons/Ionicons';

const APP_ICON = require('../assets/images/app-icon.png');

/** Clear the status bar / notch. Prefer live metrics; fall back for early calls. */
export function getToastTopOffset() {
  const inset =
    initialWindowMetrics?.insets?.top ??
    (Platform.OS === 'android' ? StatusBar.currentHeight : 0) ??
    0;
  return Math.max(inset, 20) + 12;
}

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
        <Icon name="checkmark-circle" size={24} color={colors.primary} style={{ marginLeft: moderateScale(8), alignSelf: 'center' }} />
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
        <Icon name="alert-circle" size={24} color="#ff4444" style={{ marginLeft: moderateScale(8), alignSelf: 'center' }} />
      )}
    />
  );
}

/** Foreground FCM banner — looks like a system push: app icon + title + body. */
function PushToastWithTheme(props) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  return (
    <BaseToast
      {...props}
      style={styles.pushToast}
      contentContainerStyle={styles.contentContainer}
      text1Style={styles.title}
      text2Style={styles.message}
      text2NumberOfLines={3}
      renderLeadingIcon={() => (
        <View style={styles.appIconWrap}>
          <Image source={APP_ICON} style={styles.appIcon} />
        </View>
      )}
    />
  );
}

export const toastConfig = {
  success: (props) => <SuccessToastWithTheme {...props} />,
  error: (props) => <ErrorToastWithTheme {...props} />,
  push: (props) => <PushToastWithTheme {...props} />,
};

const topToast = (extras) => ({
  position: 'top',
  topOffset: getToastTopOffset(),
  ...extras,
});

// Custom toast functions
export const showToast = {
  success: (message, title = 'Success') => {
    Toast.show(
      topToast({
        type: 'success',
        text1: title,
        text2: message,
        visibilityTime: 3000,
      }),
    );
  },
  error: (message, title = 'Error') => {
    Toast.show(
      topToast({
        type: 'error',
        text1: title,
        text2: message,
        visibilityTime: 4000,
      }),
    );
  },
  /** In-app banner for a foreground push — title + body with the app icon. */
  push: (message, title = 'Deals More') => {
    Toast.show(
      topToast({
        type: 'push',
        text1: title || 'Deals More',
        text2: message,
        visibilityTime: 4500,
      }),
    );
  },
};

// Show error toast message
export const showErrorToast = (message) => {
  Toast.show(
    topToast({
      type: 'error',
      text1: 'Error',
      text2: message,
      visibilityTime: 2000,
    }),
  );
};

// Show success toast message
export const showSuccessToast = (message, title = 'Success') => {
  Toast.show(
    topToast({
      type: 'success',
      text1: title,
      text2: message,
      visibilityTime: 2800,
    }),
  );
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
      shadowColor: '#000000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.15,
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
    pushToast: {
      borderLeftColor: colors.primary,
      borderLeftWidth: 4,
      backgroundColor: colors.surface,
      borderRadius: 14,
      marginHorizontal: 12,
      width: '92%',
      height: 'auto',
      minHeight: 68,
      paddingVertical: 10,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.18,
      shadowRadius: 8,
      elevation: 6,
    },
    appIconWrap: {
      marginLeft: moderateScale(12),
      marginRight: moderateScale(2),
      alignSelf: 'center',
      borderRadius: moderateScale(10),
      overflow: 'hidden',
    },
    appIcon: {
      width: moderateScale(40),
      height: moderateScale(40),
      borderRadius: moderateScale(10),
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
