import BrandDetailScreen from '../screens/deals/BrandDetailScreen';
import ForYouScreen from '../screens/home/ForYouScreen';
import CategoryDealsScreen from '../screens/categories/CategoryDealsScreen';
import BrandListScreen from '../screens/deals/BrandListScreen';
import DealDetailScreen from '../screens/deals/DealDetailScreen';
import NotificationsScreen from '../screens/notifications/NotificationsScreen';
import FollowedBrandsScreen from '../screens/profile/FollowedBrandsScreen';
import FavoriteCategoriesScreen from '../screens/profile/FavoriteCategoriesScreen';
import PrivacyPolicyScreen from '../screens/profile/PrivacyPolicyScreen';
import HelpSupportScreen from '../screens/profile/HelpSupportScreen';
import TermsConditionsScreen from '../screens/profile/TermsConditionsScreen';
import NotificationPreferencesScreen from '../screens/profile/NotificationPreferencesScreen';
import RequestBrandScreen from '../screens/profile/RequestBrandScreen';
import SplashScreen from '../screens/SplashScreen';
import OnboardingWelcomeScreen from '../screens/onboarding/OnboardingWelcomeScreen';
import OnboardingTopicsScreen from '../screens/onboarding/OnboardingTopicsScreen';
import OnboardingCategoriesScreen from '../screens/onboarding/OnboardingCategoriesScreen';
import OnboardingBrandsScreen from '../screens/onboarding/OnboardingBrandsScreen';
import { COLORS } from '../styles/theme';
import RootDrawer from './RootDrawer';

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
    component: RootDrawer,
  },
  {
    options: { ...stackoptions, headerShown: false },
    name: 'BrandListScreen',
    component: BrandListScreen,
  },
  {
    options: { ...stackoptions, headerShown: false },
    name: 'ForYouScreen',
    component: ForYouScreen,
  },
  {
    options: { ...stackoptions, headerShown: false },
    name: 'CategoryDealsScreen',
    component: CategoryDealsScreen,
  },
  {
    options: { ...stackoptions, headerShown: false },
    name: 'BrandDetailScreen',
    component: BrandDetailScreen,
  },
  {
    options: { ...stackoptions, headerShown: false },
    name: 'DealDetailScreen',
    component: DealDetailScreen,
  },
  {
    options: { ...stackoptions, headerShown: false },
    name: 'NotificationsScreen',
    component: NotificationsScreen,
  },
  {
    options: { ...stackoptions, headerShown: false },
    name: 'FollowedBrandsScreen',
    component: FollowedBrandsScreen,
  },
  {
    options: { ...stackoptions, headerShown: false },
    name: 'FavoriteCategoriesScreen',
    component: FavoriteCategoriesScreen,
  },
  {
    options: { ...stackoptions, headerShown: false },
    name: 'PrivacyPolicyScreen',
    component: PrivacyPolicyScreen,
  },
  {
    options: { ...stackoptions, headerShown: false },
    name: 'HelpSupportScreen',
    component: HelpSupportScreen,
  },
  {
    options: { ...stackoptions, headerShown: false },
    name: 'TermsConditionsScreen',
    component: TermsConditionsScreen,
  },
  {
    options: { ...stackoptions, headerShown: false },
    name: 'NotificationPreferencesScreen',
    component: NotificationPreferencesScreen,
  },
  {
    options: { ...stackoptions, headerShown: false },
    name: 'RequestBrandScreen',
    component: RequestBrandScreen,
  },
];

export const splashStack = [
  {
    name: 'SplashScreen',
    component: SplashScreen,
  },
];

export const onboardingStack = [
  {
    options: { ...stackoptions, headerShown: false },
    name: 'OnboardingWelcomeScreen',
    component: OnboardingWelcomeScreen,
  },
  {
    options: { ...stackoptions, headerShown: false },
    name: 'OnboardingTopicsScreen',
    component: OnboardingTopicsScreen,
  },
  {
    options: { ...stackoptions, headerShown: false },
    name: 'OnboardingCategoriesScreen',
    component: OnboardingCategoriesScreen,
  },
  {
    options: { ...stackoptions, headerShown: false },
    name: 'OnboardingBrandsScreen',
    component: OnboardingBrandsScreen,
  },
];

export const mergedStacks = [...splashStack, ...onboardingStack, ...homeStack];
