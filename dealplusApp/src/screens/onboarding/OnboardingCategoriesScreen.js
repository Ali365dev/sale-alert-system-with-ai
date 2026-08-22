import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { COLORS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import useDataStore from '../../state/dataStore';
import usePreferencesStore from '../../state/preferencesStore';
import OnboardingProgress from '../../components/OnboardingProgress';
import PrimaryButton from '../../components/PrimaryButton';
import SelectableCard from '../../components/SelectableCard';
import Logo from '../../components/Logo';

const FALLBACK_CATEGORIES = ['Fashion', 'Electronics', 'Beauty', 'Food', 'Travel', 'Sports'];

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

const OnboardingCategoriesScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const realCategories = useDataStore((state) => state.categories);
  const favoriteCategories = usePreferencesStore((state) => state.favoriteCategories);
  const toggleCategory = usePreferencesStore((state) => state.toggleCategory);

  const options = realCategories.length > 0 ? realCategories.map((c) => c.name) : FALLBACK_CATEGORIES;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + SPACING.three }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Icon name="chevron-back" size={24} color="#171717" />
        </Pressable>
        <Logo size={20} />
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <OnboardingProgress step={1} total={3} />
        <Text style={styles.title}>Choose your favorites</Text>
        <Text style={styles.subtitle}>Select the categories you want to see deals for.</Text>

        <View style={styles.grid}>
          {options.map((c) => (
            <SelectableCard key={c} label={c} icon={iconFor(c)} iconVariant="circle" selected={favoriteCategories.includes(c)} onPress={() => toggleCategory(c)} />
          ))}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.three }]}>
        <PrimaryButton
          label="Next"
          icon="arrow-forward"
          disabled={favoriteCategories.length === 0}
          onPress={() => navigation.navigate('OnboardingBrandsScreen')}
        />
      </View>
    </View>
  );
};

export default OnboardingCategoriesScreen;

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
  headerSpacer: {
    width: 24,
  },
  content: {
    paddingHorizontal: SPACING.four,
    gap: SPACING.two,
    paddingTop: SPACING.three,
  },
  title: {
    ...TYPOGRAPHY.title,
    marginTop: SPACING.three,
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
  footer: {
    paddingHorizontal: SPACING.four,
    paddingTop: SPACING.three,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
});
