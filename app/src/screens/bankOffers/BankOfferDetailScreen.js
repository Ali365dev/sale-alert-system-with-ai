import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import Skeleton from '../../components/Skeleton';
import AnimatedListItem from '../../components/AnimatedListItem';
import PhotoViewer from '../../components/PhotoViewer';
import CoverGallery from '../../components/CoverGallery';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import useTheme from '../../hooks/useTheme';
import useBankCardsStore from '../../state/bankCardsStore';
import { fetchBusinessDetail } from '../../services/bankOffersApi';
import { getBankIdByTakhfifName, SUPPORTED_BANKS } from '../../config/banks';
import { BANK_CARDS } from '../../config/bankCards';
import CARD_IMAGES from '../../config/cardImages';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import Geolocation from '@react-native-community/geolocation';

const { width: W } = Dimensions.get('window');
const COVER_H = 240;

// ─── Geo helpers ─────────────────────────────────────────────────────────────

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function openBranchDirections(branch, bizName) {
  const lat = branch.latitude ? parseFloat(branch.latitude) : null;
  const lng = branch.longitude ? parseFloat(branch.longitude) : null;
  const label = encodeURIComponent(branch.name || bizName || 'Branch');
  if (lat && lng) {
    const url =
      Platform.OS === 'ios'
        ? `maps:0,0?q=${label}@${lat},${lng}`
        : `geo:${lat},${lng}?q=${lat},${lng}(${label})`;
    Linking.openURL(url).catch(() =>
      Linking.openURL(`https://maps.google.com/?q=${lat},${lng}`),
    );
  } else if (branch.address) {
    const q = encodeURIComponent(`${branch.name || ''} ${branch.address}`);
    Linking.openURL(`https://maps.google.com/?q=${q}`).catch(() => {});
  }
}

// ─── Near Me bottom sheet ─────────────────────────────────────────────────────

function NearMeSheet({ sheetRef, branches, bizName, colors }) {
  const [userLoc, setUserLoc] = useState(null);
  const [locError, setLocError] = useState(null);
  const [locLoading, setLocLoading] = useState(false);
  const snapPoints = useMemo(() => ['55%', '92%'], []);

  const requestLocation = useCallback(() => {
    setLocLoading(true);
    setLocError(null);
    Geolocation.getCurrentPosition(
      pos => {
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocLoading(false);
      },
      () => {
        setLocError('Location permission denied or unavailable');
        setLocLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  const handleSheetChange = useCallback(
    (index) => { if (index >= 0 && !userLoc && !locLoading) requestLocation(); },
    [userLoc, locLoading, requestLocation],
  );

  const NEAR_ME_RADIUS_KM = 50;

  const sortedBranches = useMemo(() => {
    const mapped = [...branches].map(b => ({
      ...b,
      dist:
        userLoc && b.latitude && b.longitude
          ? haversineKm(userLoc.lat, userLoc.lng, parseFloat(b.latitude), parseFloat(b.longitude))
          : null,
    }));

    const filtered = userLoc
      ? mapped.filter(b => b.dist == null || b.dist <= NEAR_ME_RADIUS_KM)
      : mapped;

    return filtered.sort((a, b) => {
      if (a.dist == null) return 1;
      if (b.dist == null) return -1;
      return a.dist - b.dist;
    });
  }, [userLoc, branches]);

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      onChange={handleSheetChange}
      backgroundStyle={{ backgroundColor: colors.surface }}
      handleIndicatorStyle={{ backgroundColor: colors.textSecondary }}>
      <BottomSheetScrollView contentContainerStyle={styles.nearMeContent}>
        {/* Header */}
        <View style={styles.nearMeHeader}>
          <Icon name="location" size={18} color={colors.primary} />
          <Text style={[styles.nearMeTitle, { color: colors.text }]}>Near Me</Text>
          {locLoading && (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 8 }} />
          )}
          {!locLoading && userLoc && (
            <Pressable onPress={requestLocation} style={{ marginLeft: 'auto' }}>
              <Icon name="refresh-outline" size={18} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>

        {/* Error banner */}
        {locError && (
          <View style={[styles.nearMeError, { backgroundColor: `${colors.danger}18`, borderColor: `${colors.danger}40` }]}>
            <Icon name="warning-outline" size={15} color={colors.danger} />
            <Text style={[styles.nearMeErrorTxt, { color: colors.danger }]}>{locError}</Text>
            <Pressable onPress={requestLocation}>
              <Text style={[styles.nearMeRetry, { color: colors.danger }]}>Retry</Text>
            </Pressable>
          </View>
        )}

        {/* Branch count */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: 4 }]}>
          {sortedBranches.length} LOCATION{sortedBranches.length !== 1 ? 'S' : ''}
          {userLoc ? ` WITHIN ${NEAR_ME_RADIUS_KM} KM` : ''}
        </Text>

        {/* Branch cards */}
        {sortedBranches.map((branch, i) => (
          <View
            key={branch.id ?? i}
            style={[styles.nearMeCard, { borderColor: colors.border }]}>
            <View style={[styles.nearMeIdx, { backgroundColor: `${colors.primary}18` }]}>
              <Text style={[styles.nearMeIdxTxt, { color: colors.primary }]}>{i + 1}</Text>
            </View>
            <View style={styles.nearMeCardBody}>
              <Text style={[styles.branchName, { color: colors.text }]} numberOfLines={1}>
                {branch.name || `Branch ${i + 1}`}
              </Text>
              {(branch.area || branch.address) && (
                <Text style={[styles.branchAddr, { color: colors.textSecondary }]} numberOfLines={2}>
                  {branch.area ? `${branch.area}${branch.address ? ' · ' : ''}` : ''}{branch.address ?? ''}
                </Text>
              )}
            </View>
            <View style={styles.nearMeCardRight}>
              {branch.dist != null && (
                <Text style={[styles.nearMeDist, { color: branch.dist < 2 ? colors.success ?? '#22C55E' : colors.textSecondary }]}>
                  {branch.dist < 1
                    ? `${Math.round(branch.dist * 1000)} m`
                    : `${branch.dist.toFixed(1)} km`}
                </Text>
              )}
              <Pressable
                onPress={() => openBranchDirections(branch, bizName)}
                style={[styles.dirBtn, { backgroundColor: colors.primary }]}
                accessibilityLabel="Get directions">
                <Icon name="navigate" size={14} color="#fff" />
              </Pressable>
            </View>
          </View>
        ))}

        {!sortedBranches.length && (
          <View style={styles.emptyTab}>
            <Icon name="location-outline" size={40} color={colors.textSecondary} />
            <Text style={[styles.emptyTxt, { color: colors.textSecondary }]}>
              {userLoc ? `No branches within ${NEAR_ME_RADIUS_KM} km` : 'No branches listed'}
            </Text>
          </View>
        )}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

// ─── Card image lookup ────────────────────────────────────────────────────────

function findCardImage(bankName, cardName) {
  const bankId = getBankIdByTakhfifName(bankName);
  if (!bankId) return null;
  const cards = BANK_CARDS[bankId];
  if (!cards?.length) return null;
  const cn = (cardName || '').toLowerCase();
  // Try exact substring match first
  const match = cards.find((c) => cn.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(cn));
  const entry = match ?? cards[0];
  return entry?.imageIdx ? CARD_IMAGES[entry.imageIdx] : null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TERM_ICONS = {
  'per day':        'calendar-outline',
  'per week':       'calendar-outline',
  'per month':      'calendar-outline',
  'transaction':    'card-outline',
  'restaurant':     'restaurant-outline',
  'dining':         'restaurant-outline',
  'food':           'restaurant-outline',
  'hotel':          'bed-outline',
  'room':           'bed-outline',
  'delivery':       'bicycle-outline',
  'online':         'globe-outline',
  'valid':          'checkmark-circle-outline',
  'discount':       'pricetag-outline',
};

function termIcon(term) {
  const lc = term.toLowerCase();
  for (const [kw, icon] of Object.entries(TERM_ICONS)) {
    if (lc.includes(kw)) return icon;
  }
  return 'information-circle-outline';
}

// Gradient pairs: [from, to] — rich but not overly saturated
const BANK_GRADIENTS = [
  ['#4F46E5', '#7C3AED'],  // indigo → violet
  ['#059669', '#0D9488'],  // emerald → teal
  ['#DC2626', '#DB2777'],  // red → pink
  ['#D97706', '#EA580C'],  // amber → orange
  ['#2563EB', '#7C3AED'],  // blue → violet
  ['#0891B2', '#0D9488'],  // cyan → teal
  ['#9333EA', '#EC4899'],  // purple → pink
  ['#B45309', '#D97706'],  // brown → amber
];

function bankGradient(idx) {
  return BANK_GRADIENTS[idx % BANK_GRADIENTS.length];
}

function openMap(address) {
  const q = encodeURIComponent(address);
  const url = Platform.OS === 'ios'
    ? `maps://maps.apple.com/?q=${q}`
    : `https://maps.google.com/?q=${q}`;
  Linking.openURL(url).catch(() => {});
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function formatExpiry(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  const now = new Date();
  const expired = d < now;
  const label = d.toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
  return { label, expired };
}

function ActionButtons({ phone, website, bizName, onNearMe, onShare }) {
  const { colors } = useTheme();
  const hasPhone = !!phone;
  const hasWeb = !!website;

  const actions = [
    {
      icon: 'navigate', label: 'Near Me',
      filled: true,
      onPress: onNearMe,
    },
    {
      icon: 'call-outline', label: 'Call',
      onPress: () => hasPhone && Linking.openURL(`tel:${phone}`).catch(() => {}),
      disabled: !hasPhone,
    },
    {
      icon: 'globe-outline', label: 'Website',
      onPress: () => hasWeb && Linking.openURL(website).catch(() => {}),
      disabled: !hasWeb,
    },
    {
      icon: 'share-outline', label: 'Share',
      onPress: onShare,
    },
  ];

  return (
    <View style={styles.actionRow}>
      {actions.map((a) => (
        <Pressable
          key={a.label}
          onPress={a.onPress}
          disabled={a.disabled}
          style={[
            styles.actionBtn,
            a.filled
              ? { backgroundColor: colors.primary }
              : { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
            a.disabled && { opacity: 0.4 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={a.label}>
          <Icon name={a.icon} size={18} color={a.filled ? '#fff' : colors.primary} />
          <Text style={[styles.actionLabel, { color: a.filled ? '#fff' : colors.text }]}>
            {a.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function StatBar({ biz, bankOffers, colors }) {
  const maxDisc = bankOffers.reduce((m, b) => Math.max(m, b.max_discount || 0), 0);
  const maxText = bankOffers.find(b => b.max_discount === maxDisc)?.max_discount_text;
  const stats = [
    {
      top: biz.review_count ? `${(biz.review_count / 1000).toFixed(0)}K RATINGS` : 'RATINGS',
      mid: biz.rating ? biz.rating.toFixed(1) : '—',
      bot: biz.rating ? '★★★★★'.slice(0, Math.round(biz.rating)) : '',
    },
    {
      top: 'SAVE',
      mid: maxDisc ? `${maxDisc}%` : '—',
      bot: maxText ?? '',
      accent: true,
    },
    {
      top: 'BANKS',
      mid: String(bankOffers.length),
      bot: bankOffers.length === 1 ? 'bank' : 'banks',
    },
    {
      top: 'BRANCHES',
      mid: String(biz.branches?.length || 1),
      bot: biz.city || 'city',
    },
  ];
  return (
    <View style={[styles.statBar, { borderColor: colors.border }]}>
      {stats.map((s, i) => (
        <View key={i} style={[styles.statCell, i < 3 && { borderRightWidth: 1, borderRightColor: colors.border }]}>
          <Text style={[styles.statTop, { color: colors.textSecondary }]}>{s.top}</Text>
          <Text style={[styles.statMid, { color: s.accent ? colors.primary : colors.text }]}>{s.mid}</Text>
          {!!s.bot && <Text style={[styles.statBot, { color: colors.textSecondary }]} numberOfLines={1}>{s.bot}</Text>}
        </View>
      ))}
    </View>
  );
}

// Strips a bank's name prefix from a card name so "MCB Visa Platinum Credit Card"
// and "Visa Platinum Credit Card" normalize to the same string.
function normalizeCardName(cardName, bankId) {
  const bank = SUPPORTED_BANKS.find((b) => b.id === bankId);
  if (!bank) return cardName.toLowerCase();
  for (const prefix of [bank.name, bank.id.toUpperCase()]) {
    const p = prefix.toLowerCase() + ' ';
    const n = cardName.toLowerCase();
    if (n.startsWith(p)) return n.slice(p.length);
  }
  return cardName.toLowerCase();
}

// ── Offers tab ────────────────────────────────────────────────────────────────

function OffersTab({ bankOffers, colors, savedCards }) {
  const defaultBankIndex = useMemo(() => {
    if (!savedCards?.length) return 0;
    const idx = bankOffers.findIndex((b) => {
      const bankId = getBankIdByTakhfifName(b.bank_name);
      if (!bankId) return false;
      return b.cards?.some((card) =>
        savedCards.some((c) => {
          if (c.bankId !== bankId) return false;
          if (c.cardName && card.card_name) {
            return normalizeCardName(c.cardName, c.bankId) === normalizeCardName(card.card_name, c.bankId);
          }
          return true;
        })
      );
    });
    return idx >= 0 ? idx : 0;
  }, [bankOffers, savedCards]);

  const [selectedBank, setSelectedBank] = useState(bankOffers[defaultBankIndex] ?? null);
  const [termsExpanded, setTermsExpanded] = useState(false);
  const [activeDot, setActiveDot] = useState(defaultBankIndex);
  const bankScrollRef = useRef(null);

  const CARD_W = W * 0.48;
  const CARD_STEP = CARD_W + 10; // card width + gap

  useEffect(() => {
    if (defaultBankIndex > 0) {
      setTimeout(() => {
        bankScrollRef.current?.scrollTo({ x: defaultBankIndex * CARD_STEP, animated: false });
      }, 0);
    }
  }, []);

  const handleBankScroll = useCallback((e) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / CARD_STEP);
    setActiveDot(Math.max(0, Math.min(idx, bankOffers.length - 1)));
  }, [CARD_STEP, bankOffers.length]);

  const selectBank = useCallback((b, i) => {
    setSelectedBank(b);
    setTermsExpanded(false);
    setActiveDot(i);
    bankScrollRef.current?.scrollTo({ x: i * CARD_STEP, animated: true });
  }, [CARD_STEP]);

  if (bankOffers.length === 0) {
    return (
      <View style={styles.emptyTab}>
        <Icon name="card-outline" size={40} color={colors.textSecondary} />
        <Text style={[styles.emptyTxt, { color: colors.textSecondary }]}>No bank offers yet</Text>
      </View>
    );
  }

  const inWallet = (cardName) => {
    const bankId = selectedBank
      ? getBankIdByTakhfifName(selectedBank.bank_name)
      : null;
    if (!bankId) return false;
    return savedCards.some((c) => {
      if (c.bankId !== bankId) return false;
      // Match by exact card name when available
      if (c.cardName && cardName) {
        return normalizeCardName(c.cardName, c.bankId) === normalizeCardName(cardName, c.bankId);
      }
      // Fallback: bank-only match for cards saved without a name
      return true;
    });
  };

  return (
    <View>
      {/* Bank selector cards */}
      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>BANK OFFERS</Text>
      <View>
      <ScrollView
        ref={bankScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onScroll={handleBankScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.bankCardsScroll}>
        {bankOffers.map((b, i) => {
          const [grad1, grad2] = bankGradient(i);
          const sel = selectedBank?.bank_name === b.bank_name;
          return (
            <Pressable
              key={b.bank_name}
              onPress={() => selectBank(b, i)}
              style={[
                styles.bankOfferCard,
                { backgroundColor: grad1, borderColor: sel ? '#fff' : 'transparent',
                  shadowColor: grad1, shadowOpacity: sel ? 0.45 : 0.25 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${b.bank_name} offers`}>

              {/* Blob decorations — simulates gradient smoothing */}
              <View style={[styles.bankBlob1, { backgroundColor: grad2 }]} />
              <View style={[styles.bankBlob2, { backgroundColor: grad2 + 'AA' }]} />

              {/* Content sits above blobs */}
              <View style={{ zIndex: 1 }}>
                <View style={styles.bankOfferCardTop}>
                  <Text style={styles.bankOfferCardName} numberOfLines={2}>
                    {b.bank_name}
                  </Text>
                  {sel && (
                    <View style={styles.bankOfferCheck}>
                      <Icon name="checkmark" size={12} color={grad1} />
                    </View>
                  )}
                </View>

                <Text style={styles.bankOfferPct}>
                  {b.max_discount}%
                  <Text style={styles.bankOfferOff}> off</Text>
                </Text>

                {b.max_discount_amount ? (
                  <Text style={styles.bankOfferCap} numberOfLines={1}>
                    up to Rs. {Number(b.max_discount_amount).toLocaleString()}
                  </Text>
                ) : null}

                {(() => {
                  const earliest = b.cards
                    .map((c) => c.expiry_date)
                    .filter(Boolean)
                    .sort()[0];
                  const exp = formatExpiry(earliest);
                  return exp ? (
                    <Text style={[styles.bankOfferCap, exp.expired && { color: 'rgba(255,180,180,0.9)' }]} numberOfLines={1}>
                      {exp.expired ? 'Expired ' : 'Valid until '}{exp.label}
                    </Text>
                  ) : null;
                })()}

                <View style={styles.bankOfferBadge}>
                  <Icon name="card-outline" size={10} color="rgba(255,255,255,0.9)" />
                  <Text style={styles.bankOfferBadgeTxt}>
                    {b.cards.length} card{b.cards.length !== 1 ? 's' : ''}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Right-edge gradient fade — hints at more cards */}
      {bankOffers.length > 2 && activeDot < bankOffers.length - 1 && (
        <View style={styles.bankScrollFade} pointerEvents="none">
          <View style={[styles.bankFadeSlice, { opacity: 0.08, backgroundColor: colors.background }]} />
          <View style={[styles.bankFadeSlice, { opacity: 0.2,  backgroundColor: colors.background }]} />
          <View style={[styles.bankFadeSlice, { opacity: 0.42, backgroundColor: colors.background }]} />
          <View style={[styles.bankFadeSlice, { opacity: 0.68, backgroundColor: colors.background }]} />
          <View style={[styles.bankFadeSlice, { opacity: 0.88, backgroundColor: colors.background }]} />
        </View>
      )}

      {/* Dot indicators — only when more than 2 banks */}
      {bankOffers.length > 2 && (
        <View style={styles.bankDots}>
          {bankOffers.map((_, i) => (
            <View
              key={i}
              style={[
                styles.bankDot,
                { backgroundColor: i === activeDot ? colors.primary : colors.border,
                  width: i === activeDot ? 16 : 6 },
              ]}
            />
          ))}
        </View>
      )}
      </View>

      {/* Eligible cards */}
      {selectedBank && (
        <>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: 20 }]}>
            ELIGIBLE CARDS
          </Text>
          <View style={[styles.eligibleBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {selectedBank.cards.map((card, i) => {
              const wallet = inWallet(card.card_name);
              const cardImg = findCardImage(selectedBank.bank_name, card.card_name);
              return (
                <View
                  key={i}
                  style={[
                    styles.eligibleRow,
                    i < selectedBank.cards.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                  ]}>
                  {cardImg ? (
                    <FastImage source={cardImg} style={styles.eligibleCardImg} resizeMode={FastImage.resizeMode.cover} />
                  ) : (
                    <View style={[styles.eligibleCardIcon, { backgroundColor: `${colors.primary}22` }]}>
                      <Icon name="card" size={18} color={colors.primary} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.eligibleCardName, { color: colors.text }]} numberOfLines={1}>
                      {card.card_name || 'All cards'}
                    </Text>
                    {(() => {
                      const exp = formatExpiry(card.expiry_date);
                      return exp ? (
                        <Text style={{ fontSize: 11, color: exp.expired ? '#EF4444' : colors.textSecondary, marginTop: 2 }}>
                          {exp.expired ? 'Expired ' : 'Until '}{exp.label}
                        </Text>
                      ) : null;
                    })()}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    {wallet && (
                      <View style={[styles.inWalletBadge, { marginBottom: 4 }]}>
                        <Text style={styles.inWalletTxt}>In Wallet</Text>
                      </View>
                    )}
                    {card.discount_percentage ? (
                      <Text style={[styles.eligibleDisc, { color: colors.primary }]}>
                        {card.discount_percentage}% off
                      </Text>
                    ) : null}
                    {card.max_discount_amount ? (
                      <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                        up to Rs. {Number(card.max_discount_amount).toLocaleString()}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>

          {/* Terms & Conditions — single paragraph */}
          {selectedBank.terms.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: 20 }]}>
                TERMS & CONDITIONS
              </Text>
              <View style={[styles.termsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.termsCardHeader}>
                  <Icon name="document-text-outline" size={15} color={colors.textSecondary} />
                  <Text style={[styles.termsCardTitle, { color: colors.textSecondary }]}>
                    {selectedBank.bank_name}
                  </Text>
                </View>
                {(termsExpanded ? selectedBank.terms : selectedBank.terms.slice(0, 3)).map((term, i) => (
                  <View key={i} style={styles.termBulletRow}>
                    <View style={[styles.termBulletDot, { backgroundColor: colors.textSecondary }]} />
                    <Text style={[styles.termsBody, { color: colors.text, flex: 1 }]}>{term}</Text>
                  </View>
                ))}
                {selectedBank.terms.length > 3 && (
                  <Pressable
                    onPress={() => setTermsExpanded((v) => !v)}
                    style={styles.termsToggle}
                    hitSlop={8}>
                    <Text style={[styles.termsToggleTxt, { color: colors.primary }]}>
                      {termsExpanded ? 'Collapse' : `Show ${selectedBank.terms.length - 3} more`}
                    </Text>
                    <Icon
                      name={termsExpanded ? 'chevron-up' : 'chevron-down'}
                      size={14}
                      color={colors.primary}
                    />
                  </Pressable>
                )}
              </View>
            </>
          )}
        </>
      )}
    </View>
  );
}

// ── Branches tab ──────────────────────────────────────────────────────────────

function BranchesTab({ branches, city, colors }) {
  const list = branches.length > 0
    ? branches
    : city ? [{ name: city, address: city }] : [];

  return (
    <View>
      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
        {list.length} LOCATION{list.length !== 1 ? 'S' : ''}
      </Text>
      {list.map((branch, i) => (
        <Pressable
          key={i}
          onPress={() => branch.address && openMap(branch.address)}
          style={[
            styles.branchRow,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderTopWidth: i === 0 ? 1 : 0,
              borderBottomWidth: 1,
              borderTopLeftRadius: i === 0 ? 14 : 0,
              borderTopRightRadius: i === 0 ? 14 : 0,
              borderBottomLeftRadius: i === list.length - 1 ? 14 : 0,
              borderBottomRightRadius: i === list.length - 1 ? 14 : 0,
            },
          ]}>
          <View style={[styles.branchIconCircle, { backgroundColor: `${colors.primary}18` }]}>
            <Icon name="location" size={18} color={colors.primary} />
          </View>
          <View style={styles.branchInfo}>
            <Text style={[styles.branchName, { color: colors.text }]}>
              {branch.name || branch.city || `Branch ${i + 1}`}
            </Text>
            {branch.address && (
              <Text style={[styles.branchAddr, { color: colors.textSecondary }]} numberOfLines={1}>
                {branch.address}
              </Text>
            )}
          </View>
          {branch.distance_km != null && (
            <Text style={[styles.branchDist, { color: colors.textSecondary }]}>
              {branch.distance_km.toFixed(1)} km
            </Text>
          )}
          <Icon name="chevron-forward" size={16} color={colors.textSecondary} />
        </Pressable>
      ))}
      {list.length === 0 && (
        <View style={styles.emptyTab}>
          <Icon name="location-outline" size={40} color={colors.textSecondary} />
          <Text style={[styles.emptyTxt, { color: colors.textSecondary }]}>No branches listed</Text>
        </View>
      )}
    </View>
  );
}

// ── About tab ─────────────────────────────────────────────────────────────────

function AboutTab({ biz, colors }) {
  const [photoIdx, setPhotoIdx] = useState(null);
  const contacts = [
    biz.phone   && { icon: 'call',           label: 'Phone',     value: biz.phone,                     action: () => Linking.openURL(`tel:${biz.phone}`).catch(() => {}) },
    biz.website && { icon: 'globe',           label: 'Website',   value: biz.website,                   action: () => Linking.openURL(biz.website).catch(() => {}) },
    biz.social_links?.instagram && !biz.social_links.instagram.includes('takhfif') && { icon: 'logo-instagram', label: 'Instagram', value: `@${biz.social_links.instagram.replace(/.*instagram\.com\/?/, '').replace(/\/$/, '') || biz.social_links.instagram}`, action: () => Linking.openURL(biz.social_links.instagram).catch(() => {}) },
    biz.social_links?.facebook  && !biz.social_links.facebook.includes('takhfif')  && { icon: 'logo-facebook',  label: 'Facebook',  value: 'Facebook',    action: () => Linking.openURL(biz.social_links.facebook).catch(() => {}) },
  ].filter(Boolean);

  return (
    <View>
      {biz.description && (
        <Text style={[styles.aboutDesc, { color: colors.text }]}>{biz.description}</Text>
      )}

      {biz.gallery?.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>PHOTOS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 20 }}>
            {biz.gallery.map((url, i) => (
              <Pressable key={i} onPress={() => setPhotoIdx(i)} accessibilityRole="button" accessibilityLabel={`View photo ${i + 1}`}>
                <FastImage
                  source={{ uri: url, priority: FastImage.priority.low, cache: FastImage.cacheControl.web }}
                  style={styles.galleryImg}
                  resizeMode={FastImage.resizeMode.cover}
                />
              </Pressable>
            ))}
          </ScrollView>
          {photoIdx != null && (
            <PhotoViewer images={biz.gallery} startIndex={photoIdx} onClose={() => setPhotoIdx(null)} />
          )}
        </>
      )}

      {contacts.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>CONTACT</Text>
          <View style={[styles.contactBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {contacts.map((c, i) => (
              <Pressable
                key={c.label}
                onPress={c.action}
                style={[
                  styles.contactRow,
                  i < contacts.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                ]}>
                <View style={[styles.contactIconWrap, { backgroundColor: colors.background }]}>
                  <Icon name={c.icon} size={18} color={colors.primary} />
                </View>
                <Text style={[styles.contactLabel, { color: colors.text }]}>{c.label}</Text>
                <Text style={[styles.contactValue, { color: colors.primary }]} numberOfLines={1}>{c.value}</Text>
                <Icon name="chevron-forward" size={14} color={colors.textSecondary} />
              </Pressable>
            ))}
          </View>
        </>
      )}

      {biz.last_scraped_at && (
        <Text style={[styles.sourceNote, { color: colors.textSecondary }]}>
          Last updated {new Date(biz.last_scraped_at).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
        </Text>
      )}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

const TABS = ['Offers', 'Branches', 'About'];

export default function BankOfferDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  // Accept either a full snapshot or just an id
  const { business: snapshot, businessId } = route.params ?? {};
  const id = businessId ?? snapshot?.id;

  const savedCards = useBankCardsStore((s) => s.cards);

  const nearMeRef = useRef(null);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState(0);
  const [saved, setSaved] = useState(false);

  const TAB_CONTENT_W = W;
  const TAB_ITEM_W = (W - 32) / 3;
  const tabSlide = useSharedValue(0);
  const tabIndicator = useSharedValue(0);
  const animatedTabRow = useAnimatedStyle(() => ({
    transform: [{ translateX: tabSlide.value }],
  }));
  const animatedIndicator = useAnimatedStyle(() => ({
    transform: [{ translateX: tabIndicator.value }],
  }));

  const handleTabChange = useCallback((i) => {
    setTab(i);
    const springCfg = { damping: 22, stiffness: 220, overshootClamping: true };
    tabSlide.value = withSpring(-i * TAB_CONTENT_W, springCfg);
    tabIndicator.value = withSpring(i * TAB_ITEM_W, springCfg);
  }, [TAB_CONTENT_W, TAB_ITEM_W, tabSlide, tabIndicator]);

  const load = useCallback(() => {
    if (!id) { setLoading(false); setError('No business ID'); return; }
    setLoading(true);
    setError(null);
    fetchBusinessDetail(id)
      .then(setData)
      .catch((e) => setError(e?.message ?? 'Failed to load'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const biz = data?.business ?? snapshot ?? null;
  const bankOffers = data?.bank_offers ?? [];

  // Best offer for bottom bar
  const topOffer = bankOffers[0];

  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <StatusBar barStyle="light-content" />
        {/* Cover skeleton */}
        <Skeleton width={W} height={COVER_H} radius={0} />
        {/* Back button over cover */}
        <View style={[styles.headerOverlay, { top: insets.top + 4 }]}>
          <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn} hitSlop={8}>
            <Icon name="chevron-back" size={22} color="#fff" />
          </Pressable>
        </View>
        {/* Biz card skeleton */}
        <View style={[styles.bizCard, { backgroundColor: colors.surface }]}>
          <View style={[styles.bizCardTop, { marginBottom: 12 }]}>
            <Skeleton width={56} height={56} radius={14} />
            <View style={{ flex: 1, gap: 8 }}>
              <Skeleton width={W * 0.4} height={16} />
              <Skeleton width={W * 0.3} height={11} />
            </View>
          </View>
          {/* Action buttons skeleton */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} width={(W - 32 - 24) / 4} height={52} radius={12} />)}
          </View>
          {/* Stat bar skeleton */}
          <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 12 }}>
            {[1, 2, 3, 4].map((i) => (
              <View key={i} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                <Skeleton width={36} height={8} />
                <Skeleton width={28} height={18} />
              </View>
            ))}
          </View>
        </View>
        {/* Tab bar skeleton */}
        <View style={[styles.tabBar, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 16 }]}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center', paddingVertical: 12 }}>
              <Skeleton width={48} height={12} radius={6} />
            </View>
          ))}
        </View>
        {/* Offer cards skeleton — fills rest of screen */}
        <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16, gap: 12 }}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={[{ borderRadius: 16, padding: 16, gap: 10, backgroundColor: colors.surface }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Skeleton width={40} height={40} radius={10} />
                <View style={{ flex: 1, gap: 7 }}>
                  <Skeleton width={W * 0.45} height={13} />
                  <Skeleton width={W * 0.3} height={10} />
                </View>
                <Skeleton width={60} height={26} radius={8} />
              </View>
              <Skeleton width={W - 64} height={9} />
              <Skeleton width={(W - 64) * 0.7} height={9} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (error || !biz) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <StatusBar barStyle="dark-content" />
        <View style={[styles.headerOverlay, { paddingTop: insets.top + 8, position: 'relative' }]}>
          <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn} hitSlop={8}>
            <Icon name="chevron-back" size={22} color={colors.text} />
          </Pressable>
        </View>
        <View style={styles.loadingCenter}>
          <Icon name="alert-circle-outline" size={48} color={colors.primary} />
          <Text style={[styles.emptyTxt, { color: colors.text, marginTop: 12 }]}>{error ?? 'Not found'}</Text>
          <Pressable onPress={load} style={[styles.retryBtn, { backgroundColor: colors.primary }]}>
            <Text style={styles.retryTxt}>Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const galleryImages = [
    ...(biz.cover_image_url ? [biz.cover_image_url] : []),
    ...(biz.gallery ?? []),
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}>
        {/* Cover gallery */}
        <CoverGallery images={galleryImages} height={COVER_H} />

        {/* Header overlay (absolute over cover) */}
        <View style={[styles.headerOverlay, { top: insets.top + 4 }]}>
          <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn} hitSlop={8} accessibilityLabel="Back">
            <Icon name="chevron-back" size={22} color="#fff" />
          </Pressable>
          <View style={styles.headerRight}>
            <Pressable
              style={styles.headerBtn} hitSlop={8} accessibilityLabel="Share"
              onPress={() => Share.share({ message: `${biz.name} — up to ${biz.max_discount ?? ''}% off with bank card offers!` }).catch(() => {})}>
              <Icon name="share-outline" size={20} color="#fff" />
            </Pressable>
            <Pressable
              style={styles.headerBtn} hitSlop={8}
              accessibilityLabel={saved ? 'Remove from saved' : 'Save'}
              onPress={() => setSaved((v) => !v)}>
              <Icon name={saved ? 'heart' : 'heart-outline'} size={20} color={saved ? '#F59E0B' : '#fff'} />
            </Pressable>
          </View>
        </View>

        {/* Business card */}
        <AnimatedListItem index={0}>
        <View style={[styles.bizCard, { backgroundColor: colors.surface }]}>
          <View style={styles.bizCardTop}>
            {biz.logo_url ? (
              <FastImage
                source={{ uri: biz.logo_url, priority: FastImage.priority.normal, cache: FastImage.cacheControl.web }}
                style={styles.bizLogo}
                resizeMode={FastImage.resizeMode.contain}
              />
            ) : (
              <View style={[styles.bizLogoPlaceholder, { backgroundColor: `${colors.primary}20` }]}>
                <Text style={[styles.bizInitial, { color: colors.primary }]}>{biz.name?.[0] ?? '?'}</Text>
              </View>
            )}
            <View style={styles.bizInfo}>
              <Text style={[styles.bizName, { color: colors.text }]}>{biz.name}</Text>
              <Text style={[styles.bizSub, { color: colors.textSecondary }]} numberOfLines={1}>
                {[biz.category, biz.city].filter(Boolean).join(' · ')}
                {biz.branches?.length ? ` · ${biz.branches.length} branches` : ''}
              </Text>
            </View>
          </View>

          <ActionButtons
            phone={biz.phone}
            website={biz.website}
            bizName={biz.name}
            onNearMe={() => nearMeRef.current?.expand()}
            onShare={() => Share.share({ message: `${biz.name} — up to ${biz.max_discount ?? ''}% off with bank card offers!` }).catch(() => {})}
          />
          <StatBar biz={biz} bankOffers={bankOffers} colors={colors} />
        </View>
        </AnimatedListItem>

        {/* Tab bar */}
        <AnimatedListItem index={1}>
        <View style={[styles.tabBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Sliding pill indicator */}
          <Animated.View
            style={[
              styles.tabIndicator,
              { width: TAB_ITEM_W, backgroundColor: colors.primary + '18' },
              animatedIndicator,
            ]}
          />
          {TABS.map((t, i) => (
            <Pressable
              key={t}
              onPress={() => handleTabChange(i)}
              style={styles.tabItem}>
              <Text style={[
                styles.tabLabel,
                { color: i === tab ? colors.primary : colors.textSecondary },
                i === tab && styles.tabLabelActive,
              ]}>
                {t}
              </Text>
            </Pressable>
          ))}
        </View>
        </AnimatedListItem>

        {/* Tab content — sliding row, TAB_CONTENT_W = W so clip is exact */}
        <AnimatedListItem index={2}>
        <View style={{ overflow: 'hidden', width: W }}>
          <Animated.View style={[{ flexDirection: 'row', width: W * 3 }, animatedTabRow]}>
            <View style={{ width: W, paddingHorizontal: 16, paddingTop: 16 }}>
              <OffersTab bankOffers={bankOffers} colors={colors} savedCards={savedCards} />
            </View>
            <View style={{ width: W, paddingHorizontal: 16, paddingTop: 16 }}>
              <BranchesTab branches={biz.branches ?? []} city={biz.city} colors={colors} />
            </View>
            <View style={{ width: W, paddingHorizontal: 16, paddingTop: 16 }}>
              <AboutTab biz={biz} colors={colors} />
            </View>
          </Animated.View>
        </View>
        </AnimatedListItem>
      </ScrollView>

      {/* Bottom sticky CTA */}
      {topOffer && (
        <AnimatedListItem index={3}>
        <View style={[styles.bottomBar, { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: insets.bottom + 8 }]}>
          {(() => {
            const img = findCardImage(topOffer.bank_name, topOffer.cards[0]?.card_name);
            return img ? (
              <FastImage source={img} style={styles.bottomBarCardImg} resizeMode={FastImage.resizeMode.cover} />
            ) : (
              <View style={[styles.bottomBarLeft, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Icon name="card" size={18} color={colors.textSecondary} />
              </View>
            );
          })()}
          <View style={styles.bottomBarText}>
            <Text style={[styles.bottomBarTitle, { color: colors.text }]} numberOfLines={1}>
              Save {topOffer.max_discount}% with {topOffer.bank_name}
            </Text>
            <Text style={[styles.bottomBarSub, { color: colors.textSecondary }]} numberOfLines={1}>
              {topOffer.cards[0]?.card_name ?? ''}{topOffer.max_discount_text ? ` · ${topOffer.max_discount_text}` : ''}
            </Text>
          </View>
          <Pressable
            onPress={() => Share.share({ message: `${biz?.name} — up to ${biz?.max_discount ?? ''}% off with bank card offers!` }).catch(() => {})}
            style={[styles.goBtn, { backgroundColor: colors.primary }]}
            accessibilityRole="button"
            accessibilityLabel="Share this deal">
            <Icon name="share-outline" size={16} color="#fff" />
          </Pressable>
        </View>
        </AnimatedListItem>
      )}

      {/* Near Me bottom sheet */}
      <NearMeSheet
        sheetRef={nearMeRef}
        branches={biz?.branches ?? []}
        bizName={biz?.name}
        colors={colors}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  headerOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  headerRight: { flexDirection: 'row', gap: 4 },
  headerBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.38)',
    alignItems: 'center', justifyContent: 'center',
  },

  bizCard: {
    marginHorizontal: 16, marginTop: -20, borderRadius: 20,
    padding: 16, paddingBottom: 0,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  bizCardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  bizLogo: { width: 56, height: 56, borderRadius: 14 },
  bizLogoPlaceholder: { width: 56, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  bizInitial: { fontSize: 22, fontWeight: '900' },
  bizInfo: { flex: 1 },
  bizName: { fontSize: 18, fontWeight: '900' },
  bizSub: { fontSize: 13, marginTop: 2 },

  actionRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  actionBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, gap: 4,
  },
  actionLabel: { fontSize: 11, fontWeight: '600' },

  statBar: {
    flexDirection: 'row', borderTopWidth: 1,
  },
  statCell: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  statTop: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textAlign: 'center' },
  statMid: { fontSize: 18, fontWeight: '900', marginTop: 2 },
  statBot: { fontSize: 10, marginTop: 1, textAlign: 'center' },

  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16, marginTop: 16,
    borderRadius: 14, borderWidth: 1,
    overflow: 'hidden',
  },
  tabIndicator: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  tabItem: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabLabel: { fontSize: 14, fontWeight: '600' },
  tabLabelActive: { fontWeight: '800' },

  sectionLabel: {
    fontSize: 11, fontWeight: '800', letterSpacing: 1,
    marginBottom: 10,
  },

  // Bank offer cards
  bankCardsScroll: { gap: 10, paddingRight: 16, paddingBottom: 4 },
  bankScrollFade: {
    position: 'absolute', right: 0, top: 0, bottom: 4,
    width: 56, flexDirection: 'row',
  },
  bankFadeSlice: { flex: 1, height: '100%' },
  bankDots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 10 },
  bankDot: { height: 6, borderRadius: 3 },
  bankOfferCard: {
    width: W * 0.48, borderRadius: 20, padding: 14, minHeight: 130,
    overflow: 'hidden', borderWidth: 2,
    shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  // Blob shapes that blend to simulate gradient smoothing
  bankBlob1: {
    position: 'absolute', width: W * 0.36, height: W * 0.36,
    borderRadius: W * 0.18, bottom: -W * 0.12, right: -W * 0.08,
    opacity: 0.75,
  },
  bankBlob2: {
    position: 'absolute', width: W * 0.22, height: W * 0.22,
    borderRadius: W * 0.11, top: -W * 0.06, right: W * 0.1,
    opacity: 0.5,
  },
  bankOfferCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  bankOfferCardName: { color: '#fff', fontSize: 12, fontWeight: '700', flex: 1, lineHeight: 17 },
  bankOfferCheck: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center', marginLeft: 6,
  },
  bankOfferPct: { color: '#fff', fontSize: 30, fontWeight: '900', marginBottom: 1 },
  bankOfferOff: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '500' },
  bankOfferCap: { color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: '600', marginBottom: 2 },
  bankOfferBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8, paddingVertical: 4, marginTop: 8,
  },
  bankOfferBadgeTxt: { color: 'rgba(255,255,255,0.9)', fontSize: 10, fontWeight: '700' },

  // Eligible cards
  eligibleBox: { borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 4 },
  eligibleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  eligibleCardIcon: { width: 56, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  eligibleCardImg: { width: 56, height: 36, borderRadius: 8, backgroundColor: '#eee' },
  eligibleCardName: { flex: 1, fontSize: 13, fontWeight: '600' },
  inWalletBadge: { backgroundColor: '#D1FAE5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  inWalletTxt: { color: '#065F46', fontSize: 11, fontWeight: '700' },
  eligibleDisc: { fontSize: 13, fontWeight: '600' },

  // Disclaimer
  termsCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 8,
  },
  termsCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  termsCardTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
  termBulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  termBulletDot: { width: 5, height: 5, borderRadius: 2.5, marginTop: 8, flexShrink: 0 },
  termsBody: { fontSize: 13, lineHeight: 22, letterSpacing: 0.1 },
  termsToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  termsToggleTxt: { fontSize: 13, fontWeight: '700' },
  disclaimer: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#FEF3C7', borderRadius: 12,
    padding: 12, marginTop: 10,
  },
  disclaimerTxt: { color: '#92400E', fontSize: 12, flex: 1, lineHeight: 18 },

  // Terms
  termsBox: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  termRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  termIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  termTxt: { flex: 1, fontSize: 13, lineHeight: 18 },

  // Branches
  branchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderLeftWidth: 1, borderRightWidth: 1,
  },
  branchIconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  branchInfo: { flex: 1 },
  branchName: { fontSize: 14, fontWeight: '700' },
  branchAddr: { fontSize: 12, marginTop: 2 },
  branchDist: { fontSize: 13, fontWeight: '600' },

  // About
  aboutDesc: { fontSize: 14, lineHeight: 22, marginBottom: 20 },
  galleryImg: { width: 160, height: 100, borderRadius: 12 },
  contactBox: { borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 16 },
  contactRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  contactIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  contactLabel: { fontSize: 14, fontWeight: '600', flex: 1 },
  contactValue: { fontSize: 13, fontWeight: '600', maxWidth: 160 },
  sourceNote: { fontSize: 11, marginBottom: 8 },
  reportLink: { fontSize: 14, fontWeight: '600', textAlign: 'center', marginTop: 8, marginBottom: 20 },

  // Loading / error
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, minHeight: 300 },
  emptyTab: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyTxt: { fontSize: 14 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20, marginTop: 16 },
  retryTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Bottom bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: 1,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: -4 }, elevation: 8,
  },
  bottomBarLeft: {
    width: 56, height: 36, borderRadius: 8, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  bottomBarCardImg: { width: 56, height: 36, borderRadius: 8 },
  bottomBarText: { flex: 1 },
  bottomBarTitle: { fontSize: 13, fontWeight: '700' },
  bottomBarSub: { fontSize: 11, marginTop: 2 },
  goBtn: {
    borderRadius: 50,
    width: 44, height: 44,
    alignItems: 'center', justifyContent: 'center',
  },
  goBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '900' },

  // Near Me sheet
  nearMeContent: { paddingHorizontal: 16, paddingBottom: 40 },
  nearMeHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 16, paddingTop: 4,
  },
  nearMeTitle: { fontSize: 17, fontWeight: '700' },
  nearMeError: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 10, borderWidth: 1, padding: 10, marginBottom: 12,
  },
  nearMeErrorTxt: { flex: 1, fontSize: 13 },
  nearMeRetry: { fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },
  nearMeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10,
  },
  nearMeIdx: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
  },
  nearMeIdxTxt: { fontSize: 14, fontWeight: '800' },
  nearMeCardBody: { flex: 1 },
  nearMeCardRight: { alignItems: 'flex-end', gap: 6 },
  nearMeDist: { fontSize: 13, fontWeight: '700' },
  dirBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
});
