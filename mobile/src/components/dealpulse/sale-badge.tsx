import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

interface Props {
  label: string;
  tone?: 'red' | 'yellow' | 'gray' | 'green';
  icon?: keyof typeof Ionicons.glyphMap;
}

const DARK_TEXT_TONES: Props['tone'][] = ['yellow', 'gray'];

export function SaleBadge({ label, tone = 'red', icon }: Props) {
  const isDarkText = DARK_TEXT_TONES.includes(tone);
  return (
    <View style={[styles.badge, styles[tone]]}>
      {icon && <Ionicons name={icon} size={10} color={isDarkText ? '#171717' : '#FFFFFF'} />}
      <ThemedText type="label" style={[styles.text, isDarkText ? styles.textDark : styles.textLight]}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  red: {
    backgroundColor: '#DB322F',
  },
  yellow: {
    backgroundColor: '#F5CB1B',
  },
  gray: {
    backgroundColor: '#E5E7EB',
  },
  green: {
    backgroundColor: '#16A34A',
  },
  text: {
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 0.4,
  },
  textLight: {
    color: '#FFFFFF',
  },
  textDark: {
    color: '#171717',
  },
});
