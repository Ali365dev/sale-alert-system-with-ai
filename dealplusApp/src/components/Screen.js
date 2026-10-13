import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useTheme from '../hooks/useTheme';

/**
 * Screen root that respects notches / status bar / home indicator.
 * Use instead of a plain View so loading skeletons and headers aren't cut off
 * under a translucent StatusBar. Prefer edges={['top','left','right']} on tab
 * screens (tab bar already clears the bottom inset).
 */
const Screen = ({ children, style, edges = ['top', 'left', 'right'], ...rest }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView style={[styles.root, style]} edges={edges} {...rest}>
      {children}
    </SafeAreaView>
  );
};

export default Screen;

const createStyles = (colors) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
  });
