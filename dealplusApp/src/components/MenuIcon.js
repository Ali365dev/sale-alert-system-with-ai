import Svg, { Rect } from 'react-native-svg';

/** Exact menu (hamburger) icon — staggered bars from Figma. */
export function MenuIcon({ color = '#10233F', size = 36 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      <Rect y={9} width={20} height={2} rx={1} fill={color} />
      <Rect y={17} width={14} height={2} rx={1} fill={color} />
      <Rect y={25} width={20} height={2} rx={1} fill={color} />
    </Svg>
  );
}

export default MenuIcon;
