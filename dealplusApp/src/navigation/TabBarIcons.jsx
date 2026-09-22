import Svg, { Path } from 'react-native-svg';

/** Exact Home icon from Figma — solid house + white smile stroke. */
export function HomeTabIcon({ color, size = 26 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
      <Path
        d="M12.1698 2.4924C12.6527 2.0634 13.3472 2.0634 13.8301 2.4924L21.2587 9.09548C21.9049 9.67026 22.2857 10.4865 22.2857 11.35V19.9644C22.2857 21.7593 20.8306 23.2144 19.0357 23.2144H6.96423C5.1693 23.2144 3.71423 21.7593 3.71423 19.9644V11.35C3.71423 10.4865 4.09495 9.67026 4.74123 9.09548L12.1698 2.4924V2.4924"
        fill={color}
      />
      <Path
        d="M10.2142 13.4644C10.2142 15.003 11.4613 16.2501 12.9999 16.2501C14.5386 16.2501 15.7857 15.003 15.7857 13.4644"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={2.04286}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Exact Explore icon from Figma — 2×2 rounded outline grid. */
export function ExploreTabIcon({ color, size = 24 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5.5 3.5H8.3C9.40383 3.5 10.3 4.39617 10.3 5.5V8.3C10.3 9.40383 9.40383 10.3 8.3 10.3H5.5C4.39617 10.3 3.5 9.40383 3.5 8.3V5.5C3.5 4.39617 4.39617 3.5 5.5 3.5V3.5"
        fill="none"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M15.7 3.5H18.5C19.6038 3.5 20.5 4.39617 20.5 5.5V8.3C20.5 9.40383 19.6038 10.3 18.5 10.3H15.7C14.5961 10.3 13.7 9.40383 13.7 8.3V5.5C13.7 4.39617 14.5961 3.5 15.7 3.5V3.5"
        fill="none"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M5.5 13.7H8.3C9.40383 13.7 10.3 14.5961 10.3 15.7V18.5C10.3 19.6038 9.40383 20.5 8.3 20.5H5.5C4.39617 20.5 3.5 19.6038 3.5 18.5V15.7C3.5 14.5961 4.39617 13.7 5.5 13.7V13.7"
        fill="none"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M15.7 13.7H18.5C19.6038 13.7 20.5 14.5961 20.5 15.7V18.5C20.5 19.6038 19.6038 20.5 18.5 20.5H15.7C14.5961 20.5 13.7 19.6038 13.7 18.5V15.7C13.7 14.5961 14.5961 13.7 15.7 13.7V13.7"
        fill="none"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Exact Profile icon from Figma — head circle + open shoulder arc. */
export function ProfileTabIcon({ color, size = 25 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 25 25" fill="none">
      <Path
        d="M8.33337 7.29167C8.33337 9.59131 10.2004 11.4583 12.5 11.4583C14.7997 11.4583 16.6667 9.59131 16.6667 7.29167C16.6667 4.99202 14.7997 3.125 12.5 3.125C10.2004 3.125 8.33337 4.99202 8.33337 7.29167V7.29167"
        fill="none"
        stroke={color}
        strokeWidth={2.29167}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M5.72913 21.3542C5.72913 17.1876 8.85413 15.1042 12.5 15.1042C16.1458 15.1042 19.2708 17.1876 19.2708 21.3542"
        fill="none"
        stroke={color}
        strokeWidth={2.29167}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function TabBarIcon({ name, color }) {
  switch (name) {
    case 'Home':
      return <HomeTabIcon color={color} size={26} />;
    case 'Explore':
      return <ExploreTabIcon color={color} size={24} />;
    case 'Profile':
      return <ProfileTabIcon color={color} size={25} />;
    default:
      return <HomeTabIcon color={color} size={26} />;
  }
}
