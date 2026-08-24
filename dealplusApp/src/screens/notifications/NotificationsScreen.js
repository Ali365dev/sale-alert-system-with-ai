import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Ionicons';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import useDataStore from '../../state/dataStore';
import { loadDeals } from '../../services/dealsService';
import { usePressScale } from '../../hooks/usePressScale';
import AnimatedListItem from '../../components/AnimatedListItem';
import EmptyState from '../../components/EmptyState';
import FilterChip from '../../components/FilterChip';
import TopAppBar from '../../components/TopAppBar';

const ICON_BY_KIND = {
  'price-drop': 'heart',
  'new-brand': 'pricetag',
  'flash-sale': 'stopwatch',
};

const CIRCLE_BG = {
  'price-drop': '#DCEAFB',
  'new-brand': '#8A7A00',
  'flash-sale': '#FBDCDC',
};

const ICON_COLOR = {
  'price-drop': '#171717',
  'new-brand': '#FFFFFF',
  'flash-sale': '#B7131A',
};

const FILTERS = ['All Alerts', 'New Deals', 'Expiring Soon'];

function AlertRow({ item, onPress }) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.98);
  const urgent = item.kind === 'flash-sale' && !item.read;

  return (
    <Animated.View style={animatedStyle}>
      <Pressable style={[styles.card, urgent && styles.cardUrgent]} onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
        <View style={[styles.iconCircle, { backgroundColor: item.read ? '#EDEDED' : CIRCLE_BG[item.kind] }]}>
          <Icon name={item.read ? 'notifications' : ICON_BY_KIND[item.kind]} size={20} color={item.read ? '#9CA3AF' : ICON_COLOR[item.kind]} />
        </View>
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
  const alerts = useDataStore((state) => state.alerts);
  const error = useDataStore((state) => state.error);
  const [filter, setFilter] = useState('All Alerts');

  const visible = useMemo(() => {
    if (filter === 'New Deals') return alerts.filter((a) => !a.read);
    if (filter === 'Expiring Soon') return alerts.filter((a) => a.kind === 'flash-sale');
    return alerts;
  }, [alerts, filter]);

  return (
    <View style={styles.container}>
      <TopAppBar showBack title="Notifications" hideSearch hideProfile />
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
                onPress={() => {
                  if (item.dealId) navigation.navigate('DealDetailScreen', { id: item.dealId });
                  else if (item.brandId) navigation.navigate('BrandDetailScreen', { id: item.brandId });
                }}
              />
            </AnimatedListItem>
          )}
        />
      )}
    </View>
  );
};

export default NotificationsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: SPACING.four,
    paddingTop: SPACING.three,
    gap: SPACING.three,
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
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: '#F0DADA',
    padding: SPACING.three,
    marginBottom: SPACING.three,
    ...SHADOWS.card,
  },
  cardUrgent: {
    borderLeftWidth: 3,
    borderLeftColor: '#B7131A',
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
    color: COLORS.text,
  },
  titleRead: {
    color: COLORS.textSecondary,
  },
  timeLabel: {
    ...TYPOGRAPHY.small,
    color: COLORS.textSecondary,
  },
  body: {
    ...TYPOGRAPHY.small,
    color: COLORS.textSecondary,
  },
  timeBadge: {
    backgroundColor: '#DB322F',
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
    color: '#B7131A',
    marginTop: 2,
  },
});
