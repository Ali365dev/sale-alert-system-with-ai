import { Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY } from '../styles/theme';

const SectionHeader = ({ title, onViewAll }) => {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {onViewAll && (
        <Pressable hitSlop={8} onPress={onViewAll}>
          <Text style={styles.link}>See All</Text>
        </Pressable>
      )}
    </View>
  );
};

export default SectionHeader;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.four,
    marginBottom: SPACING.two,
  },
  title: {
    ...TYPOGRAPHY.headline,
    color: COLORS.text,
  },
  link: {
    ...TYPOGRAPHY.linkPrimary,
  },
});
