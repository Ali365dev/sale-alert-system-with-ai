import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SPACING } from '../styles/theme';
import useTheme from '../hooks/useTheme';

/** Small footer spinner shown while the next page of an already-loaded list is being revealed. */
const PaginationLoader = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="small" color={colors.textSecondary} />
    </View>
  );
};

export default PaginationLoader;

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      paddingVertical: SPACING.four,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
