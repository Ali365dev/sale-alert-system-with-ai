import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FullWindowOverlay } from 'react-native-screens';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import Icon from 'react-native-vector-icons/Ionicons';
import { SPACING, TYPOGRAPHY } from '../styles/theme';
import useTheme from '../hooks/useTheme';
import useLoginPromptStore from '../state/loginPromptStore';
import { navigate } from '../utils/NavigationUtil';
import PrimaryButton from './PrimaryButton';

const SNAP_POINTS = [320];

/** Same overlay host as CouponSheet so login can stack *above* an open coupon. */
const SheetContainer = ({ children }) =>
  Platform.OS === 'ios' ? <FullWindowOverlay>{children}</FullWindowOverlay> : children;

const COPY = {
  deal: {
    title: 'Save your favorites',
    body: 'Sign in to save deals and find them again anytime in Favorites.',
  },
  store: {
    title: 'Follow this store',
    body: 'Sign in to follow brands and get alerts when they drop new deals.',
  },
};

/**
 * Login gate — Gorhom modal with FullWindowOverlay + stackBehavior="push"
 * so it appears in front of CouponSheet (RN Modal sat behind that overlay).
 */
const LoginPromptSheet = () => {
  const sheetRef = useRef(null);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const open = useLoginPromptStore((s) => s.open);
  const kind = useLoginPromptStore((s) => s.kind);
  const hide = useLoginPromptStore((s) => s.hide);
  const copy = COPY[kind] || COPY.deal;

  useEffect(() => {
    if (!open) return undefined;
    let nested;
    const outer = requestAnimationFrame(() => {
      nested = requestAnimationFrame(() => {
        sheetRef.current?.present();
      });
    });
    return () => {
      cancelAnimationFrame(outer);
      if (nested != null) cancelAnimationFrame(nested);
    };
  }, [open, kind]);

  const renderBackdrop = useCallback(
    (props) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.55}
        pressBehavior="close"
      />
    ),
    [],
  );

  const dismiss = useCallback(() => {
    sheetRef.current?.dismiss();
  }, []);

  const goLogin = () => {
    dismiss();
    setTimeout(() => navigate('SignInScreen'), 80);
  };

  return (
    <BottomSheetModal
      ref={sheetRef}
      onDismiss={hide}
      index={0}
      snapPoints={SNAP_POINTS}
      enableDynamicSizing={false}
      enablePanDownToClose
      stackBehavior="push"
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handle}
      containerComponent={SheetContainer}>
      <BottomSheetView style={[styles.body, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <View style={styles.iconWrap}>
          <Icon name="heart" size={28} color={colors.primary} />
        </View>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.bodyText}>{copy.body}</Text>
        <PrimaryButton label="Log in to continue" pill onPress={goLogin} style={styles.cta} />
        <Pressable onPress={dismiss} hitSlop={8} style={styles.dismissBtn} accessibilityRole="button">
          <Text style={styles.dismissLabel}>Not now</Text>
        </Pressable>
      </BottomSheetView>
    </BottomSheetModal>
  );
};

export default LoginPromptSheet;

const createStyles = (colors) =>
  StyleSheet.create({
    background: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
    },
    handle: {
      backgroundColor: colors.border,
      width: 40,
      height: 4,
    },
    body: {
      paddingHorizontal: 24,
      paddingTop: 8,
      alignItems: 'center',
      gap: 10,
    },
    iconWrap: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.errorTint,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    title: {
      ...TYPOGRAPHY.title,
      fontSize: 22,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'center',
    },
    bodyText: {
      ...TYPOGRAPHY.default,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: SPACING.two,
      paddingHorizontal: 8,
    },
    cta: {
      alignSelf: 'stretch',
      marginTop: 4,
    },
    dismissBtn: {
      paddingVertical: 12,
      marginBottom: 4,
    },
    dismissLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textSecondary,
    },
  });
