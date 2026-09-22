import { Dimensions, Platform } from 'react-native';
import { RFValue } from 'react-native-responsive-fontsize';
import { widthPercentageToDP, heightPercentageToDP } from 'react-native-responsive-screen';

export const isIOS = Platform.OS === 'ios';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
export { SCREEN_WIDTH, SCREEN_HEIGHT };

export const WP = widthPercentageToDP;
export const HP = heightPercentageToDP;

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

/** DealPulse refined system — primary red, cool neutrals. */
export const LIGHT_COLORS = {
  text: '#10233F',
  background: '#FAF8F9',
  surface: '#FFFFFF',
  backgroundElement: '#F3F5F8',
  backgroundSelected: '#F20D38',
  textSecondary: '#6B7C93',
  border: '#E8EDF3',
  primary: '#F20D38',
  primaryDark: '#D90832',
  primarySoft: '#FFF0F3',
  accentPink: '#FDECEF',
  sale: '#F20D38',
  accent: '#D90832',
  success: '#16A36A',
  successBg: '#EAF8F1',
  warning: '#F5A623',
  warningBg: '#FFF6DF',
  info: '#3478F6',
  infoBg: '#EEF4FF',
  onPrimary: '#FFFFFF',
  white: '#FFFFFF',
  black: '#000000',
  skeletonBase: '#E4E2E3',
  error: '#BA1A1A',
  errorTint: '#FDECEF',
  inverseSurface: '#303031',
  tagBackground: '#FFF0F3',
  bannerYellow: '#F5A623',
  mutedInk: '#9AA7B8',
};

export const DARK_COLORS = {
  text: '#F2F0F1',
  background: '#1B1C1D',
  surface: '#303031',
  backgroundElement: '#3A3B3C',
  backgroundSelected: '#F20D38',
  textSecondary: '#9AA7B8',
  border: '#4A4B4C',
  primary: '#F20D38',
  primaryDark: '#D90832',
  primarySoft: '#3A151C',
  accentPink: '#4A2024',
  sale: '#F20D38',
  accent: '#FFB3B1',
  success: '#16A36A',
  successBg: '#163024',
  warning: '#F5A623',
  warningBg: '#3A2E14',
  info: '#3478F6',
  infoBg: '#1A2840',
  onPrimary: '#FFFFFF',
  white: '#FFFFFF',
  black: '#000000',
  skeletonBase: '#3A3B3C',
  error: '#FFB4AB',
  errorTint: '#3A1518',
  inverseSurface: '#F2F0F1',
  tagBackground: '#3A151C',
  bannerYellow: '#F5A623',
  mutedInk: '#9AA7B8',
};

export const COLORS = LIGHT_COLORS;

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
  button: 13,
  sheet: 22,
};

export const SHADOWS = isIOS
  ? {
      card: {
        shadowColor: '#10233F',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 18,
      },
      raised: {
        shadowColor: '#10233F',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
      },
      button: {
        shadowColor: '#F20D38',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.22,
        shadowRadius: 10,
      },
    }
  : {
      card: { elevation: 2 },
      raised: { elevation: 6 },
      button: { elevation: 4 },
    };

export const IMAGES = {};

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
