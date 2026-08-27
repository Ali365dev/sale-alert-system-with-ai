import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { COLORS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import useDataStore from '../../state/dataStore';
import usePreferencesStore from '../../state/preferencesStore';
import { saveInterests } from '../../services/preferencesApi';
import SelectableCard from '../../components/SelectableCard';
import EmptyState from '../../components/EmptyState';

const ICONS = [
  { match: /fashion|apparel|clothing|retail/i, icon: 'shirt-outline' },
  { match: /electronic|software|tech/i, icon: 'laptop-outline' },
  { match: /beauty|cosmetic|personal care|skincare/i, icon: 'happy-outline' },
  { match: /food|restaurant|grocery|dining/i, icon: 'restaurant-outline' },
  { match: /travel/i, icon: 'airplane-outline' },
  { match: /sport|fitness|outdoor/i, icon: 'football-outline' },
  { match: /home|furniture|garden/i, icon: 'home-outline' },
  { match: /gaming|game|entertainment|movie|music/i, icon: 'game-controller-outline' },
  { match: /news|media/i, icon: 'newspaper-outline' },
  { match: /footwear|shoe/i, icon: 'footsteps-outline' },
  { match: /web|digital|service/i, icon: 'globe-outline' },
  { match: /pet|animal/i, icon: 'paw-outline' },
  { match: /book|education|learning/i, icon: 'book-outline' },
  { match: /health|wellness|medical/i, icon: 'medkit-outline' },
  { match: /automotive|car|vehicle/i, icon: 'car-outline' },
  { match: /jewelry|jewellery|accessor|watch/i, icon: 'diamond-outline' },
  { match: /baby|kid|toy/i, icon: 'gift-outline' },
  { match: /office|stationery/i, icon: 'briefcase-outline' },
];
const DEFAULT_ICON = 'pricetag-outline';

const iconFor = (name) => ICONS.find((c) => c.match.test(name))?.icon ?? DEFAULT_ICON;

const FavoriteCategoriesScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const categories = useDataStore((state) => state.categories);
  const favoriteCategories = usePreferencesStore((state) => state.favoriteCategories);
  const toggleCategory = usePreferencesStore((state) => state.toggleCategory);

  const handleToggle = (name) => {
    toggleCategory(name);
    saveInterests({ categories: usePreferencesStore.getState().favoriteCategories });
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + SPACING.three }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Icon name="chevron-back" size={24} color="#171717" />
        </Pressable>
        <Text style={styles.headerTitle}>Favorite Categories</Text>
        <View style={styles.headerSpacer} />
      </View>

      {categories.length === 0 ? (
        <EmptyState icon="pricetags-outline" title="No categories yet" body="Once offers are tracked, categories will appear here." />
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.five }]} showsVerticalScrollIndicator={false}>
          <Text style={styles.subtitle}>Tailor your feed by selecting what you want to see most.</Text>
          <View style={styles.grid}>
            {categories.map((c) => (
              <SelectableCard
                key={c.name}
                label={c.name}
                icon={iconFor(c.name)}
                iconVariant="circle"
                selected={favoriteCategories.includes(c.name)}
                onPress={() => handleToggle(c.name)}
              />
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
};

export default FavoriteCategoriesScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.four,
    paddingBottom: SPACING.two,
  },
  headerTitle: {
    ...TYPOGRAPHY.subtitle,
  },
  headerSpacer: {
    width: 24,
  },
  content: {
    paddingHorizontal: SPACING.four,
    paddingTop: SPACING.three,
    gap: SPACING.two,
  },
  subtitle: {
    ...TYPOGRAPHY.default,
    color: COLORS.textSecondary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: SPACING.four,
  },
});
