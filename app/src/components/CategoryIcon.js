import {
  Baby,
  BookOpen,
  Briefcase,
  Car,
  Dumbbell,
  Flower2,
  Footprints,
  Gamepad2,
  Gem,
  Glasses,
  HeartPulse,
  House,
  Laptop,
  LayoutGrid,
  PawPrint,
  Plane,
  Shirt,
  Sofa,
  Sparkles,
  Tag,
  Utensils,
  Watch,
} from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { iconForCategory } from '../utils/dealAdapters';

/** Ant Design outlined cloud-server. That glyph is not in the linked AntDesign font. */
const CloudServerIcon = ({ size, color }) => (
  <Svg width={size} height={size} viewBox="0 0 1024 1024">
    <Path
      d="M704 446H320c-4.4 0-8 3.6-8 8v402c0 4.4 3.6 8 8 8h384c4.4 0 8-3.6 8-8V454c0-4.4-3.6-8-8-8zm-328 64h272v117H376V510zm272 290H376V683h272v117z"
      fill={color}
    />
    <Path
      d="M424 748a32 32 0 1 0 64 0 32 32 0 1 0-64 0zm0-178a32 32 0 1 0 64 0 32 32 0 1 0-64 0z"
      fill={color}
    />
    <Path
      d="M811.4 368.9C765.6 248 648.9 162 512.2 162S258.8 247.9 213 368.8C126.9 391.5 63.5 470.2 64 563.6 64.6 668 145.6 752.9 247.6 762c4.7.4 8.7-3.3 8.7-8v-60.4c0-4-3-7.4-7-7.9-27-3.4-52.5-15.2-72.1-34.5-24-23.5-37.2-55.1-37.2-88.6 0-28 9.1-54.4 26.2-76.4 16.7-21.4 40.2-36.9 66.1-43.7l37.9-10 13.9-36.7c8.6-22.8 20.6-44.2 35.7-63.5 14.9-19.2 32.6-36 52.4-50 41.1-28.9 89.5-44.2 140-44.2s98.9 15.3 140 44.3c19.9 14 37.5 30.8 52.4 50 15.1 19.3 27.1 40.7 35.7 63.5l13.8 36.6 37.8 10c54.2 14.4 92.1 63.7 92.1 120 0 33.6-13.2 65.1-37.2 88.6-19.5 19.2-44.9 31.1-71.9 34.5-4 .5-6.9 3.9-6.9 7.9V754c0 4.7 4.1 8.4 8.8 8 101.7-9.2 182.5-94 183.2-198.2.6-93.4-62.7-172.1-148.6-194.9z"
      fill={color}
    />
  </Svg>
);

/** Outline icons, one stroke, one size — keyed by `iconForCategory`. */
const ICONS = {
  grid: LayoutGrid,
  footprints: Footprints,
  shirt: Shirt,
  laptop: Laptop,
  sparkles: Sparkles,
  utensils: Utensils,
  plane: Plane,
  dumbbell: Dumbbell,
  sofa: Sofa,
  house: House,
  flower: Flower2,
  gamepad: Gamepad2,
  watch: Watch,
  gem: Gem,
  glasses: Glasses,
  baby: Baby,
  car: Car,
  health: HeartPulse,
  book: BookOpen,
  pet: PawPrint,
  briefcase: Briefcase,
  tag: Tag,
};

/** Names saved before the Lucide switch (Material Community Icons). */
const LEGACY = {
  'tshirt-crew-outline': 'shirt',
  'tshirt-crew': 'shirt',
  'shoe-sneaker': 'footprints',
  'face-woman-outline': 'sparkles',
  'silverware-fork-knife': 'utensils',
  airplane: 'plane',
  basketball: 'dumbbell',
  'sofa-outline': 'sofa',
  'home-outline': 'house',
  'controller-classic-outline': 'gamepad',
  'tag-outline': 'tag',
};

const STROKE = 2;

/** Material Design Icons, same size and theme color as the Lucide set. */
const VECTOR = {
  bag: 'bag-personal-outline',
  windows: 'microsoft-windows-classic',
};

const resolveKey = (name) => {
  if (ICONS[name] || VECTOR[name] || name === 'server') return name;
  if (LEGACY[name]) return LEGACY[name];
  return iconForCategory(name);
};

const CategoryIcon = ({ name = 'tag', size = 22, color = '#111827' }) => {
  const key = resolveKey(name);
  if (key === 'server') return <CloudServerIcon size={size} color={color} />;
  if (VECTOR[key]) {
    return <MaterialCommunityIcons name={VECTOR[key]} size={size} color={color} />;
  }
  const Icon = ICONS[key] || Tag;
  return <Icon size={size} color={color} strokeWidth={STROKE} />;
};

export default CategoryIcon;
