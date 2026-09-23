import { useMemo, useState } from 'react';
import {
  Dimensions,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Clipboard from '@react-native-clipboard/clipboard';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { SHADOWS } from '../../styles/theme';
import useTheme from '../../hooks/useTheme';
import useAuthStore from '../../state/authStore';
import useDataStore from '../../state/dataStore';
import { loadDeals } from '../../services/dealsService';
import { showSuccessToast } from '../../utils/CustomToast';
import CouponCard from '../../components/CouponCard';
import { useCouponSheet } from '../../components/CouponSheet';
import EmptyState from '../../components/EmptyState';
import Skeleton from '../../components/Skeleton';
import ViewSwitcher from '../../components/ViewSwitcher';
import useViewMode from '../../hooks/useViewMode';

const { width: SCREEN_W } = Dimensions.get('window');
const PAD = 20;
const BANNER_W = SCREEN_W - PAD * 2;
const BANNER_GAP = 12;
// Tallest slide (1024×395) sets carousel height so neither image is cropped.
const BANNER_H = Math.round(BANNER_W * (395 / 1024));

const PROMO_BANNERS = [
  {
    id: 'top-brands',
    source: require('../../assets/images/home-promo-banner.png'),
    label: 'Explore deals up to 70 percent off',
    backgroundColor: '#E60023',
  },
  {
    id: 'cat-fall',
    source: require('../../assets/images/home-promo-banner-cat.jpg'),
    label: 'CAT Footwear Fall Haul, up to 25 percent off',
    backgroundColor: '#111111',
  },
];

const CATEGORY_ITEMS = [
  { id: 'all', label: 'All', icon: 'view-grid-outline', lib: 'mci' },
  { id: 'Fashion', label: 'Fashion', icon: 'tshirt-crew-outline', lib: 'mci' },
  { id: 'Watches', label: 'Watches', icon: 'watch-outline', lib: 'ion' },
  { id: 'Beauty', label: 'Beauty', icon: 'sparkles-outline', lib: 'ion' },
  { id: 'Dining', label: 'Dining', icon: 'restaurant-outline', lib: 'ion' },
  { id: 'Tech', label: 'Tech', icon: 'phone-portrait-outline', lib: 'ion' },
];

const firstName = (raw) => {
  const value = (raw || '').trim();
  if (!value) return 'there';
  return value.split(/\s+/)[0] || 'there';
};

/** Exact home UI from provided screenshot. */
const HomeScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const deals = useDataStore((state) => state.deals);
  const brands = useDataStore((state) => state.brands);
  const brandsById = useDataStore((state) => state.brandsById);
  const loading = useDataStore((state) => state.loading);
  const error = useDataStore((state) => state.error);
  const user = useAuthStore((state) => state.user);
  const greeting = user
    ? `Hi, ${firstName(user.name || user.displayName)} 👋`
    : 'Hi there! 👋';

  const [activeCategory, setActiveCategory] = useState('all');
  const [bannerIndex, setBannerIndex] = useState(0);
  const [gridView, setGridView] = useViewMode(false);
  const { openCoupon, couponSheet } = useCouponSheet();

  const couponList = useMemo(() => {
    let list = [...deals];
    if (activeCategory !== 'all') {
      list = list.filter((d) => {
        const brand = brandsById[d.brandId];
        const cat = `${d.category || ''} ${brand?.category || ''}`.toLowerCase();
        return cat.includes(activeCategory.toLowerCase());
      });
    }
    return list;
  }, [deals, brandsById, activeCategory]);

  const onCopy = (code) => {
    Clipboard.setString(code);
    showSuccessToast('Code copied');
  };

  const onBannerScroll = (event) => {
    const x = event.nativeEvent.contentOffset.x;
    const next = Math.round(x / (BANNER_W + BANNER_GAP));
    if (next !== bannerIndex && next >= 0 && next < PROMO_BANNERS.length) {
      setBannerIndex(next);
    }
  };

  if (error && deals.length === 0 && brands.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <EmptyState
          variant="error"
          icon="warning-outline"
          title="Couldn't load deals"
          body="Check your connection and try again."
          ctaLabel="Try again"
          onPressCta={loadDeals}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadDeals} tintColor={colors.primary} />}>
        {/* Top: Hi greeting + bell */}
        <View style={styles.topBar}>
          <View style={styles.greetingBlock}>
            <Text style={styles.greeting}>{greeting}</Text>
            <Text style={styles.greetingSub}>Save more on things you love.</Text>
          </View>
          <Pressable hitSlop={10} onPress={() => navigation.navigate('NotificationsScreen')} style={styles.bellWrap}>
            <Icon name="notifications-outline" size={24} color={colors.text} />
            <View style={styles.bellDot} />
          </Pressable>
        </View>

        {/* Search */}
        <Pressable style={styles.searchBar} onPress={() => navigation.navigate('SearchScreen')}>
          <Icon name="search" size={18} color={colors.textSecondary} />
          <Text style={styles.searchPlaceholder}>Search for stores, categories, deals...</Text>
        </Pressable>

        {/* Promo banners */}
        <View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={BANNER_W + BANNER_GAP}
            snapToAlignment="start"
            disableIntervalMomentum
            contentContainerStyle={styles.bannerRow}
            onScroll={onBannerScroll}
            scrollEventThrottle={16}>
            {PROMO_BANNERS.map((banner) => (
              <Pressable
                key={banner.id}
                style={[styles.bannerWrap, { width: BANNER_W, height: BANNER_H, backgroundColor: banner.backgroundColor }]}
                onPress={() => navigation.navigate('Explore')}
                accessibilityRole="button"
                accessibilityLabel={banner.label}>
                <Image source={banner.source} style={styles.bannerImage} resizeMode="contain" />
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.dots}>
            {PROMO_BANNERS.map((banner, i) => (
              <View key={banner.id} style={[styles.dot, i === bannerIndex && styles.dotActive]} />
            ))}
          </View>
        </View>

        {/* Categories */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Categories</Text>
          <Pressable onPress={() => navigation.navigate('CategoriesScreen')} hitSlop={8}>
            <Text style={styles.seeAll}>See all</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
          {CATEGORY_ITEMS.map((cat) => {
            const active = activeCategory === cat.id;
            const color = active ? colors.sale : colors.textSecondary;
            return (
              <Pressable key={cat.id} style={styles.categoryItem} onPress={() => setActiveCategory(cat.id)}>
                <View style={[styles.categoryIcon, active && styles.categoryIconActive]}>
                  {cat.lib === 'mci' ? (
                    <MaterialCommunityIcons name={cat.icon} size={22} color={color} />
                  ) : (
                    <Icon name={cat.icon} size={22} color={color} />
                  )}
                </View>
                <Text style={[styles.categoryLabel, active && styles.categoryLabelActive]}>{cat.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Popular Coupons — Figma ticket cards (list + grid) */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Popular Coupons</Text>
            <Text style={styles.sectionFlame}>🔥</Text>
          </View>
          <ViewSwitcher gridView={gridView} onChange={setGridView} />
        </View>

        {loading && couponList.length === 0 ? (
          <View style={styles.couponList}>
            <Skeleton width={BANNER_W} height={128} radius={18} />
            <Skeleton width={BANNER_W} height={128} radius={18} />
          </View>
        ) : couponList.length === 0 ? (
          <EmptyState
            icon="pricetag-outline"
            title="No coupons yet"
            body="Coupons will appear here once deals are tracked."
            ctaLabel="Refresh"
            onPressCta={loadDeals}
          />
        ) : gridView ? (
          <View style={styles.couponGrid}>
            {couponList.slice(0, 20).map((deal) => {
              const brand = brandsById[deal.brandId];
              return (
                <View key={deal.id} style={styles.couponGridItem}>
                  <CouponCard
                    deal={deal}
                    brand={brand}
                    variant="vertical"
                    onPress={() => openCoupon(deal)}
                  />
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.couponList}>
            {couponList.slice(0, 20).map((deal) => {
              const brand = brandsById[deal.brandId];
              return (
                <CouponCard
                  key={deal.id}
                  deal={deal}
                  brand={brand}
                  variant="horizontal"
                  onPress={() => openCoupon(deal)}
                />
              );
            })}
          </View>
        )}
      </ScrollView>
      {couponSheet}
    </View>
  );
};

export default HomeScreen;

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: {
      gap: 18,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingHorizontal: PAD,
      gap: 12,
    },
    bellWrap: {
      position: 'relative',
      padding: 2,
      marginTop: 4,
    },
    bellDot: {
      position: 'absolute',
      top: 1,
      right: 2,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
    },
    greetingBlock: {
      flex: 1,
      gap: 4,
    },
    greeting: {
      fontSize: 28,
      lineHeight: 34,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.4,
    },
    greetingSub: {
      fontSize: 15,
      lineHeight: 20,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginHorizontal: PAD,
      height: 48,
      paddingHorizontal: 16,
      borderRadius: 999,
      backgroundColor: colors.surface,
      ...SHADOWS.card,
    },
    searchPlaceholder: {
      flex: 1,
      fontSize: 14,
      color: colors.textSecondary,
    },
    bannerRow: {
      paddingHorizontal: PAD,
      gap: BANNER_GAP,
    },
    bannerWrap: {
      borderRadius: 22,
      overflow: 'hidden',
      ...SHADOWS.card,
    },
    bannerImage: {
      width: '100%',
      height: '100%',
    },
    dots: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
      marginTop: 12,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#D1D5DB',
    },
    dotActive: {
      width: 18,
      backgroundColor: colors.primary,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: PAD,
      marginBottom: 4,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.text,
    },
    sectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    sectionFlame: {
      fontSize: 16,
    },
    seeAll: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.sale,
    },
    categoryRow: {
      paddingHorizontal: PAD,
      gap: 14,
    },
    categoryItem: {
      alignItems: 'center',
      width: 64,
      gap: 6,
    },
    categoryIcon: {
      width: 56,
      height: 56,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    categoryIconActive: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primarySoft,
    },
    categoryLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    categoryLabelActive: {
      color: colors.sale,
    },
    couponList: {
      paddingHorizontal: PAD,
      gap: 16,
      overflow: 'visible',
    },
    couponGrid: {
      paddingHorizontal: PAD,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 16,
    },
    couponGridItem: {
      width: (SCREEN_W - PAD * 2 - 16) / 2,
      overflow: 'visible',
    },
  });
