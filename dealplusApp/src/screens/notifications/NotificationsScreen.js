import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Ionicons';
import { RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import useTheme from '../../hooks/useTheme';
import useDataStore from '../../state/dataStore';
import { loadDeals } from '../../services/dealsService';
import { usePressScale } from '../../hooks/usePressScale';
import AnimatedListItem from '../../components/AnimatedListItem';
import BrandLogo from '../../components/BrandLogo';
import EmptyState from '../../components/EmptyState';
import FilterChip from '../../components/FilterChip';
import TopAppBar from '../../components/TopAppBar';

// Small per-kind decorative accents — deliberately theme-invariant (same
// reasoning as SaleBadge/CategoryCard's tile colors). Used only when there is
// no brand to show a logo for (e.g. generic push alerts).
const ICON_BY_KIND = {
  'price-drop': 'heart',
  'new-brand': 'pricetag',
  'flash-sale': 'stopwatch',
};

const CIRCLE_BG = {
  'price-drop': '#EEF4FF',
  'new-brand': '#FFF0F3',
  'flash-sale': '#FDECEF',
};

const ICON_COLOR = {
  'price-drop': '#3478F6',
  'new-brand': '#F20D38',
  'flash-sale': '#D90832',
};

const FILTERS = ['All Alerts', 'New Deals', 'Flash Sales'];

function AlertRow({ item, brand, onPress, colors, styles }) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.98);
  const urgent = item.kind === 'flash-sale' && !item.read;

  return (
    <Animated.View style={animatedStyle}>
      <Pressable style={[styles.card, urgent && styles.cardUrgent]} onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
        {brand ? (
          <BrandLogo brand={brand} size={52} tone="filled" fit="cover" />
        ) : (
          <View style={[styles.iconCircle, { backgroundColor: item.read ? colors.backgroundElement : CIRCLE_BG[item.kind] }]}>
            <Icon
              name={item.read ? 'notifications' : ICON_BY_KIND[item.kind] ?? 'notifications'}
              size={20}
              color={item.read ? colors.textSecondary : ICON_COLOR[item.kind] ?? colors.primary}
            />
          </View>
        )}
        <View style={styles.textBlock}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, item.read && styles.titleRead]} numberOfLines={1}>
              {item.title}
            </Text>
            {urgent ? (
              <View style={styles.timeBadge}>
                <Text style={styles.timeBadgeLabel}>{item.time}</Text>
              </View>
            ) : (
              <Text style={styles.timeLabel}>{item.time}</Text>
            )}
          </View>
          <Text style={styles.body} numberOfLines={2}>
            {item.body}
          </Text>
          {urgent && <Text style={styles.viewDeal}>VIEW DEAL</Text>}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const NotificationsScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const alerts = useDataStore((state) => state.alerts);
  const brandsById = useDataStore((state) => state.brandsById);
  const error = useDataStore((state) => state.error);
  const [filter, setFilter] = useState('All Alerts');

  const visible = useMemo(() => {
    if (filter === 'New Deals') return alerts.filter((a) => !a.read);
    if (filter === 'Flash Sales') return alerts.filter((a) => a.kind === 'flash-sale');
    return alerts;
  }, [alerts, filter]);

  return (
    <View style={styles.container}>
      <TopAppBar showBack title="Notifications" hideProfile />
      {error && alerts.length === 0 ? (
        <EmptyState variant="error" icon="warning-outline" title="Couldn't load alerts" body="Check your connection and try again." ctaLabel="Try again" onPressCta={loadDeals} />
      ) : alerts.length === 0 ? (
        <EmptyState
          icon="notifications-outline"
          title="No alerts yet"
          body="Once your backend tracks new offers, flash sales and new-brand alerts will show up here."
          ctaLabel="Refresh"
          onPressCta={loadDeals}
        />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(a) => a.id}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.four }]}
          ListHeaderComponent={
            <View style={styles.header}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                {FILTERS.map((f) => (
                  <FilterChip key={f} label={f} selected={filter === f} onPress={() => setFilter(f)} />
                ))}
              </ScrollView>
            </View>
          }
          renderItem={({ item, index }) => (
            <AnimatedListItem index={index}>
              <AlertRow
                item={item}
                brand={item.brandId ? brandsById[item.brandId] : null}
                onPress={() => {
                  if (item.dealId) navigation.navigate('DealDetailScreen', { id: item.dealId });
                  else if (item.brandId) navigation.navigate('BrandDetailScreen', { id: item.brandId });
                }}
                colors={colors}
                styles={styles}
              />
            </AnimatedListItem>
          )}
        />
      )}
    </View>
  );
};

export default NotificationsScreen;

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      paddingHorizontal: SPACING.four,
      paddingTop: SPACING.three,
      gap: 5,
    },
    header: {
      gap: SPACING.three,
      marginBottom: SPACING.two,
    },
    filterRow: {
      flexDirection: 'row',
      gap: SPACING.two,
    },
    card: {
      flexDirection: 'row',
      gap: SPACING.three,
      backgroundColor: colors.surface,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.three,
      marginBottom: 0,
      ...SHADOWS.card,
    },
    cardUrgent: {
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
    },
    iconCircle: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
    },
    textBlock: {
      flex: 1,
      gap: 4,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: SPACING.two,
    },
    title: {
      ...TYPOGRAPHY.smallBold,
      flex: 1,
      color: colors.text,
    },
    titleRead: {
      color: colors.textSecondary,
    },
    timeLabel: {
      ...TYPOGRAPHY.small,
      color: colors.textSecondary,
    },
    body: {
      ...TYPOGRAPHY.small,
      color: colors.textSecondary,
    },
    timeBadge: {
      backgroundColor: colors.primary,
      paddingHorizontal: SPACING.two,
      paddingVertical: 2,
      borderRadius: RADIUS.chip,
    },
    timeBadgeLabel: {
      ...TYPOGRAPHY.label,
      color: '#FFFFFF',
      fontSize: 11,
    },
    viewDeal: {
      ...TYPOGRAPHY.label,
      color: colors.primary,
      marginTop: 2,
    },
  });
