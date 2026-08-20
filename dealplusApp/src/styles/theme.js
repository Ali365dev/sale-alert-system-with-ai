import { Dimensions, Platform } from 'react-native';
import { RFValue } from 'react-native-responsive-fontsize';
import { widthPercentageToDP, heightPercentageToDP } from 'react-native-responsive-screen';

export const isIOS = Platform.OS === 'ios';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
export { SCREEN_WIDTH, SCREEN_HEIGHT };

export const WP = widthPercentageToDP;
export const HP = heightPercentageToDP;

// Base design reference (matches mobile's original design frame).
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

export const scale = (size) => (SCREEN_WIDTH / guidelineBaseWidth) * size;
export const verticalScale = (size) => (SCREEN_HEIGHT / guidelineBaseHeight) * size;
export const moderateScale = (size, factor = 0.5) => size + (scale(size) - size) * factor;

export const FONT_SIZES = {
  xxs: RFValue(10),
  xs: RFValue(12),
  sm: RFValue(14),
  md: RFValue(16),
  lg: RFValue(18),
  xl: RFValue(22),
  xxl: RFValue(28),
};

// Matched against the DealPulse Expo app's design tokens (mobile/src/constants/theme.ts).
export const COLORS = {
  text: '#171717',
  background: '#FFFFFF',
  backgroundElement: '#F8F9FB',
  backgroundSelected: '#B7131A',
  textSecondary: '#6B7280',
  border: '#F0DADA',
  primary: '#B7131A',
  sale: '#DB322F',
  accent: '#F5CB1B',
  success: '#16A34A',
  onPrimary: '#FFFFFF',
  white: '#FFFFFF',
  black: '#000000',
};

export const SPACING = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
};

export const RADIUS = {
  chip: 999,
  card: 16,
  button: 14,
  sheet: 24,
};

export const SHADOWS = isIOS
  ? {
      card: {
        shadowColor: '#1A1A1A',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.07,
        shadowRadius: 10,
      },
      raised: {
        shadowColor: '#1A1A1A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
      },
      button: {
        shadowColor: '#B7131A',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.22,
        shadowRadius: 12,
      },
    }
  : {
      card: { elevation: 3 },
      raised: { elevation: 8 },
      button: { elevation: 5 },
    };

// Local require'd assets — populate as real assets are dropped into src/assets/images.
export const IMAGES = {};

// Text-style building blocks (ported from mobile's ThemedText type variants,
// with fontFamily swapped for fontWeight since Montserrat isn't linked yet).
export const TYPOGRAPHY = {
  small: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  smallBold: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  default: { fontSize: 16, lineHeight: 24, fontWeight: '500' },
  label: { fontSize: 14, lineHeight: 18, fontWeight: '700', letterSpacing: 0.2 },
  title: { fontSize: 32, lineHeight: 38, fontWeight: '800', letterSpacing: -0.5 },
  headline: { fontSize: 22, lineHeight: 28, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  link: { fontSize: 14, lineHeight: 30, fontWeight: '500' },
  linkPrimary: { fontSize: 14, lineHeight: 30, fontWeight: '700', color: COLORS.primary },
};
