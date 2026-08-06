import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';

interface Props {
  label: string;
  tone?: 'red' | 'yellow' | 'gray';
  icon?: keyof typeof Ionicons.glyphMap;
}

export function SaleBadge({ label, tone = 'red', icon }: Props) {
  return (
    <View style={[styles.badge, styles[tone]]}>
      {icon && (
        <Ionicons name={icon} size={11} color={tone === 'yellow' ? '#171717' : tone === 'gray' ? '#171717' : '#FFFFFF'} />
      )}
      <ThemedText type="label" style={[styles.text, tone === 'yellow' || tone === 'gray' ? styles.textDark : styles.textLight]}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: Radius.chip,
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
  text: {
    fontSize: 11,
  },
  textLight: {
    color: '#FFFFFF',
  },
  textDark: {
    color: '#171717',
  },
});
