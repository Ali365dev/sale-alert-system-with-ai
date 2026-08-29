import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SPACING, TYPOGRAPHY } from '../styles/theme';
import useTheme from '../hooks/useTheme';

const SectionHeader = ({ title, onViewAll }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

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

const createStyles = (colors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.four,
      marginBottom: SPACING.two,
    },
    title: {
      ...TYPOGRAPHY.headline,
      color: colors.text,
    },
    link: {
      ...TYPOGRAPHY.linkPrimary,
    },
  });
