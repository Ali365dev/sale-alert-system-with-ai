import BrandDetailScreen from '../screens/deals/BrandDetailScreen';
import BrandListScreen from '../screens/deals/BrandListScreen';
import DealDetailScreen from '../screens/deals/DealDetailScreen';
import NotificationsScreen from '../screens/notifications/NotificationsScreen';
import SplashScreen from '../screens/SplashScreen';
import OnboardingWelcomeScreen from '../screens/onboarding/OnboardingWelcomeScreen';
import OnboardingTopicsScreen from '../screens/onboarding/OnboardingTopicsScreen';
import OnboardingCategoriesScreen from '../screens/onboarding/OnboardingCategoriesScreen';
import OnboardingBrandsScreen from '../screens/onboarding/OnboardingBrandsScreen';
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
    options: { ...stackoptions, headerShown: false },
    name: 'BrandListScreen',
    component: BrandListScreen,
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
