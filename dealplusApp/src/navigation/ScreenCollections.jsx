import BrandDetailScreen from '../screens/deals/BrandDetailScreen';
import BrandListScreen from '../screens/deals/BrandListScreen';
import DealDetailScreen from '../screens/deals/DealDetailScreen';
import { COLORS } from '../styles/theme';
import HomeNavigator from './HomeNavigator';

const stackoptions = {
  headerShown: true,
  headerTitleAlign: 'center',
  headerTintColor: COLORS.text,
  headerBackTitleVisible: false,
  headerTitleStyle: {
    color: COLORS.text,
    fontWeight: '700',
  },
  headerStyle: {
    backgroundColor: COLORS.background,
  },
};

export const homeStack = [
  {
    name: 'MainTabs',
    component: HomeNavigator,
  },
  {
    options: { ...stackoptions, headerTitle: 'Brands' },
    name: 'BrandListScreen',
    component: BrandListScreen,
  },
  {
    options: { ...stackoptions, headerTitle: '' },
    name: 'BrandDetailScreen',
    component: BrandDetailScreen,
  },
  {
    options: { ...stackoptions, headerTitle: '' },
    name: 'DealDetailScreen',
    component: DealDetailScreen,
  },
];

export const mergedStacks = [...homeStack];
