import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

interface Props {
  title: string;
  onViewAll?: () => void;
}

export function SectionHeader({ title, onViewAll }: Props) {
  return (
    <View style={styles.row}>
      <ThemedText type="headline">{title}</ThemedText>
      {onViewAll && (
        <Pressable hitSlop={8} onPress={onViewAll}>
          <ThemedText type="linkPrimary">See All</ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.two,
  },
});
