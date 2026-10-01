import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FullWindowOverlay } from 'react-native-screens';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import Clipboard from '@react-native-clipboard/clipboard';
import Icon from 'react-native-vector-icons/Ionicons';
import { RADIUS } from '../styles/theme';
import useTheme from '../hooks/useTheme';
import useDataStore from '../state/dataStore';
import useFavoritesStore from '../state/favoritesStore';
import BrandLogo from './BrandLogo';
import FavoriteButton from './FavoriteButton';
import { channelTag } from '../utils/dealAdapters';
import { showSuccessToast } from '../utils/CustomToast';
import { isLoggedIn, toggleFavoriteDeal } from '../utils/authGate';
import useLoginPromptStore from '../state/loginPromptStore';

const howToSteps = (brandName, code) => [
  `Visit the ${brandName} website or app.`,
  'Add your favorite items to the cart.',
  code ? `Apply coupon code ${code} at checkout.` : 'Complete checkout to apply this offer.',
  'Complete your purchase and enjoy the discount.',
];

const expiresOn = (expiresAt) => {
  if (!expiresAt) return 'No expiry date';
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return 'No expiry date';
  if (date.getTime() < Date.now()) return 'Expired';
  return `Expires on ${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
};

const SNAP_POINTS = ['75%'];

const SheetContainer = ({ children }) =>
  Platform.OS === 'ios' ? <FullWindowOverlay>{children}</FullWindowOverlay> : children;

/**
 * Coupon details bottom sheet — Gorhom BottomSheetModal with a dark overlay.
 */
const CouponSheet = ({ deal, brand, onClose }) => {
  const sheetRef = useRef(null);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [copied, setCopied] = useState(false);
  const favorite = useFavoritesStore((state) => (deal ? state.favoriteIds.includes(deal.id) : false));

  useEffect(() => {
    if (!deal) return undefined;
    setCopied(false);
    const id = requestAnimationFrame(() => {
      sheetRef.current?.present();
    });
    return () => cancelAnimationFrame(id);
  }, [deal]);

  const renderBackdrop = useCallback(
    (props) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.52}
        pressBehavior="close"
      />
    ),
    [],
  );

  const onCopy = () => {
    if (!deal?.promoCode) return;
    Clipboard.setString(deal.promoCode);
    setCopied(true);
    showSuccessToast('Code copied');
    setTimeout(() => setCopied(false), 1800);
  };

  const onShare = () => {
    if (!deal) return;
    const name = brand?.name || 'this store';
    const codeLine = deal.promoCode ? ` Use code ${deal.promoCode}.` : '';
    Share.share({
      message: `${deal.title} at ${name}.${codeLine}`.trim(),
      title: 'Coupon Details',
    }).catch(() => {});
  };

  const onShop = () => {
    const url = deal?.website || brand?.website;
    if (url) Linking.openURL(url);
  };

  const name = brand?.name || 'Store';
  const code = deal?.promoCode;
  const tag = deal ? channelTag(deal) : 'ONLINE';
  const isOnline = tag === 'ONLINE';
  const linkUrl = deal?.website || brand?.website;
  const steps = howToSteps(name, code);

  return (
    <BottomSheetModal
      ref={sheetRef}
      onDismiss={onClose}
      index={0}
      snapPoints={SNAP_POINTS}
      enableDynamicSizing={false}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handleIndicator}
      containerComponent={SheetContainer}>
      {deal ? (
        <BottomSheetScrollView
          bounces={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.body}
          style={styles.scroll}>
          <View style={styles.header}>
            <Pressable
              onPress={() => sheetRef.current?.dismiss()}
              hitSlop={10}
              style={styles.headerBtn}
              accessibilityRole="button"
              accessibilityLabel="Close coupon">
              <Icon name="chevron-back" size={24} color={colors.text} />
            </Pressable>
            <Text style={styles.headerTitle}>Coupon Details</Text>
            <View style={styles.headerActions}>
              <Pressable
                onPress={onShare}
                hitSlop={8}
                style={styles.headerBtn}
                accessibilityRole="button"
                accessibilityLabel="Share coupon">
                <Icon name="share-outline" size={20} color={colors.text} />
              </Pressable>
              <FavoriteButton
                active={favorite}
                onPress={() => {
                  if (favorite || isLoggedIn()) {
                    toggleFavoriteDeal(deal.id);
                    return;
                  }
                  // Close coupon overlay first so the login sheet is not trapped behind it.
                  sheetRef.current?.dismiss();
                  setTimeout(() => useLoginPromptStore.getState().show('deal'), 280);
                }}
                size={20}
              />
            </View>
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.logoCol}>
              <BrandLogo brand={brand} size={64} tone="filled" fit="cover" elevated />
            </View>
            <View style={styles.summaryText}>
              <Text style={styles.offerTitle}>{deal.title}</Text>
              <View style={[styles.channelPill, isOnline ? styles.channelOnline : styles.channelStore]}>
                <View style={[styles.channelDot, { backgroundColor: isOnline ? colors.success : colors.warning }]} />
                <Text style={[styles.channelLabel, { color: isOnline ? colors.success : colors.warning }]}>
                  {isOnline ? 'Online' : 'In-Store'}
                </Text>
              </View>
              <Text style={styles.expiry}>{expiresOn(deal.expiresAt)}</Text>
            </View>
          </View>

          {code ? (
            <View style={styles.codeCard}>
              <View style={styles.codeSide}>
                <Text style={styles.codeLabel}>COUPON CODE</Text>
                <Text style={styles.codeValue} numberOfLines={1}>
                  {code}
                </Text>
              </View>
              <Pressable
                onPress={onCopy}
                style={styles.copyBtn}
                accessibilityRole="button"
                accessibilityLabel="Copy coupon code">
                <Text style={styles.copyLabel}>{copied ? 'Copied' : 'Copy'}</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About this offer</Text>
            <Text style={styles.sectionBody}>{deal.description || deal.title}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>How to use</Text>
            {steps.map((step, index) => (
              <View key={step} style={styles.stepRow}>
                <View style={styles.stepNum}>
                  <Text style={styles.stepNumLabel}>{index + 1}</Text>
                </View>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </View>

          {deal.terms ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Terms and Conditions</Text>
              <Text style={styles.sectionBody}>{deal.terms}</Text>
            </View>
          ) : null}

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <Pressable
              onPress={onShop}
              disabled={!linkUrl}
              style={[styles.shopBtn, !linkUrl && styles.shopBtnDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Shop Now">
              <Icon name="cart-outline" size={18} color="#FFFFFF" />
              <Text style={styles.shopLabel}>Shop Now</Text>
            </Pressable>
          </View>
        </BottomSheetScrollView>
      ) : null}
    </BottomSheetModal>
  );
};

export const useCouponSheet = () => {
  const [deal, setDeal] = useState(null);
  const brandsById = useDataStore((state) => state.brandsById);
  return {
    openCoupon: setDeal,
    couponSheet: <CouponSheet deal={deal} brand={deal ? brandsById[deal.brandId] : undefined} onClose={() => setDeal(null)} />,
  };
};

export default CouponSheet;

const createStyles = (colors) =>
  StyleSheet.create({
    background: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
    },
    handleIndicator: {
      backgroundColor: colors.border,
      width: 40,
      height: 4,
    },
    scroll: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingBottom: 8,
    },
    headerBtn: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      width: 80,
      justifyContent: 'flex-end',
      paddingRight: 8,
      gap: 4,
    },
    body: {
      paddingHorizontal: 20,
      paddingBottom: 16,
      gap: 20,
    },
    summaryRow: {
      flexDirection: 'row',
      gap: 14,
      alignItems: 'flex-start',
    },
    logoCol: {
      paddingTop: 2,
    },
    summaryText: {
      flex: 1,
      minWidth: 0,
      gap: 8,
    },
    offerTitle: {
      fontSize: 18,
      lineHeight: 24,
      fontWeight: '800',
      color: colors.text,
    },
    channelPill: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderRadius: RADIUS.chip,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    channelOnline: {
      backgroundColor: colors.successBg,
    },
    channelStore: {
      backgroundColor: colors.warningBg,
    },
    channelDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    channelLabel: {
      fontSize: 12,
      fontWeight: '700',
    },
    expiry: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    codeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: colors.border,
      borderRadius: 16,
      paddingVertical: 14,
      paddingHorizontal: 16,
      gap: 12,
    },
    codeSide: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    codeLabel: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1,
      color: colors.mutedInk,
    },
    codeValue: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: 0.6,
    },
    copyBtn: {
      backgroundColor: colors.primary,
      borderRadius: RADIUS.chip,
      paddingHorizontal: 18,
      paddingVertical: 10,
    },
    copyLabel: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '700',
    },
    section: {
      gap: 8,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
    },
    sectionBody: {
      fontSize: 14,
      lineHeight: 21,
      color: colors.textSecondary,
    },
    stepRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      paddingVertical: 2,
    },
    stepNum: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
    },
    stepNumLabel: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '800',
    },
    stepText: {
      flex: 1,
      fontSize: 14,
      lineHeight: 20,
      color: colors.textSecondary,
    },
    footer: {
      paddingTop: 4,
      paddingBottom: 8,
    },
    shopBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      borderRadius: 16,
      minHeight: 52,
    },
    shopBtnDisabled: {
      opacity: 0.4,
    },
    shopLabel: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
  });
