import BrandDetailScreen from '../screens/deals/BrandDetailScreen';
import ForYouScreen from '../screens/home/ForYouScreen';
import CategoryDealsScreen from '../screens/categories/CategoryDealsScreen';
import CategoriesScreen from '../screens/categories/CategoriesScreen';
import BrandListScreen from '../screens/deals/BrandListScreen';
import DealDetailScreen from '../screens/deals/DealDetailScreen';
import NotificationsScreen from '../screens/notifications/NotificationsScreen';
import FollowedBrandsScreen from '../screens/profile/FollowedBrandsScreen';
import DealPreferenceScreen from '../screens/profile/DealPreferenceScreen';
import FavoriteCategoriesScreen from '../screens/profile/FavoriteCategoriesScreen';
import PrivacyPolicyScreen from '../screens/profile/PrivacyPolicyScreen';
import HelpSupportScreen from '../screens/profile/HelpSupportScreen';
import TermsConditionsScreen from '../screens/profile/TermsConditionsScreen';
import NotificationPreferencesScreen from '../screens/profile/NotificationPreferencesScreen';
import RequestBrandScreen from '../screens/profile/RequestBrandScreen';
import SignInScreen from '../screens/auth/SignInScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import SearchScreen from '../screens/home/SearchScreen';
import CreateAlertTypeScreen from '../screens/saleAlerts/CreateAlertTypeScreen';
import AddProductUrlScreen from '../screens/saleAlerts/AddProductUrlScreen';
import AnalyzeProductScreen from '../screens/saleAlerts/AnalyzeProductScreen';
import ManualProductScreen from '../screens/saleAlerts/ManualProductScreen';
import AlertConditionsScreen from '../screens/saleAlerts/AlertConditionsScreen';
import AlertNotificationsScreen from '../screens/saleAlerts/AlertNotificationsScreen';
import ReviewAlertScreen from '../screens/saleAlerts/ReviewAlertScreen';
import AlertCreatedScreen from '../screens/saleAlerts/AlertCreatedScreen';
import SelectBrandForAlertScreen from '../screens/saleAlerts/SelectBrandForAlertScreen';
import AlertDetailScreen from '../screens/saleAlerts/AlertDetailScreen';
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
    name: 'SearchScreen',
    component: SearchScreen,
  },
  {
    options: { ...stackoptions, headerShown: false },
    name: 'CategoriesScreen',
    component: CategoriesScreen,
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
    name: 'DealPreferenceScreen',
    component: DealPreferenceScreen,
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
  {
    options: { ...stackoptions, headerShown: false },
    name: 'CreateAlertTypeScreen',
    component: CreateAlertTypeScreen,
  },
  {
    options: { ...stackoptions, headerShown: false },
    name: 'AddProductUrlScreen',
    component: AddProductUrlScreen,
  },
  {
    options: { ...stackoptions, headerShown: false },
    name: 'AnalyzeProductScreen',
    component: AnalyzeProductScreen,
  },
  {
    options: { ...stackoptions, headerShown: false },
    name: 'ManualProductScreen',
    component: ManualProductScreen,
  },
  {
    options: { ...stackoptions, headerShown: false },
    name: 'AlertConditionsScreen',
    component: AlertConditionsScreen,
  },
  {
    options: { ...stackoptions, headerShown: false },
    name: 'AlertNotificationsScreen',
    component: AlertNotificationsScreen,
  },
  {
    options: { ...stackoptions, headerShown: false },
    name: 'ReviewAlertScreen',
    component: ReviewAlertScreen,
  },
  {
    options: { ...stackoptions, headerShown: false },
    name: 'AlertCreatedScreen',
    component: AlertCreatedScreen,
  },
  {
    options: { ...stackoptions, headerShown: false },
    name: 'SelectBrandForAlertScreen',
    component: SelectBrandForAlertScreen,
  },
  {
    options: { ...stackoptions, headerShown: false },
    name: 'AlertDetailScreen',
    component: AlertDetailScreen,
  },
  {
    options: { ...stackoptions, headerShown: false },
    name: 'SignInScreen',
    component: SignInScreen,
  },
  {
    options: { ...stackoptions, headerShown: false },
    name: 'SignUpScreen',
    component: SignUpScreen,
  },
  {
    options: { ...stackoptions, headerShown: false },
    name: 'ForgotPasswordScreen',
    component: ForgotPasswordScreen,
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

export const mergedStacks = [...onboardingStack, ...homeStack];
