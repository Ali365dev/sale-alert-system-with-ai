import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { SPACING, TYPOGRAPHY } from '../styles/theme';
import useTheme from '../hooks/useTheme';
import useDataStore from '../state/dataStore';

/** Top inset is owned by `Screen` (SafeAreaView). Do not add insets.top here
 * or headers double-pad under the status bar. */
const TopAppBar = ({ title, showBack, onBack, hideProfile, hideBorder, rightIcon, onPressRight, rightSlot, titleAlign = 'center', style }) => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const unreadCount = useDataStore((state) => state.alerts.filter((a) => !a.read).length);
  const titleStart = titleAlign === 'left' || titleAlign === 'start';

  return (
    <View style={[styles.bar, hideBorder && styles.barNoBorder, style]}>
      <View
        style={[
          styles.side,
          titleStart && styles.sideHug,
          titleStart && !showBack && styles.sideCollapsed,
        ]}>
        {showBack ? (
          <Pressable hitSlop={8} onPress={onBack ?? (() => navigation.goBack())}>
            <Icon name="chevron-back" size={24} color={colors.text} />
          </Pressable>
        ) : null}
      </View>

      {title ? (
        <Text style={[styles.title, titleStart && styles.titleStart]} numberOfLines={1}>
          {title}
        </Text>
      ) : (
        <View style={styles.titleSpacer} />
      )}

      <View style={[styles.side, styles.sideRight, rightSlot && styles.sideRightSlot]}>
        {rightSlot ? (
          rightSlot
        ) : rightIcon ? (
          <Pressable hitSlop={8} onPress={onPressRight}>
            <Icon name={rightIcon} size={22} color={colors.text} />
          </Pressable>
        ) : (
          !hideProfile && (
            <Pressable hitSlop={8} onPress={() => navigation.navigate('NotificationsScreen')} style={styles.bellWrap}>
              <Icon name="notifications-outline" size={23} color={colors.text} />
              {unreadCount > 0 && <View style={styles.badgeDot} />}
            </Pressable>
          )
        )}
      </View>
    </View>
  );
};

export default TopAppBar;

const createStyles = (colors) =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.four,
      paddingTop: SPACING.two,
      paddingBottom: SPACING.two,
      backgroundColor: colors.background,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    barNoBorder: {
      borderBottomWidth: 0,
    },
    side: {
      width: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.three,
    },
    sideHug: {
      width: 28,
    },
    sideCollapsed: {
      width: 0,
      overflow: 'hidden',
    },
    sideRight: {
      justifyContent: 'flex-end',
    },
    sideRightSlot: {
      width: undefined,
      flexShrink: 0,
      zIndex: 2,
      gap: 4,
      marginLeft: SPACING.two,
    },
    title: {
      ...TYPOGRAPHY.subtitle,
      flex: 1,
      textAlign: 'center',
      color: colors.text,
      fontSize: 18,
      zIndex: 0,
    },
    titleStart: {
      textAlign: 'left',
      fontSize: 22,
      fontWeight: '800',
      letterSpacing: -0.3,
      paddingLeft: 0,
    },
    titleSpacer: {
      flex: 1,
    },
    bellWrap: {
      position: 'relative',
      padding: 2,
    },
    badgeDot: {
      position: 'absolute',
      top: 2,
      right: 2,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
      borderWidth: 1.5,
      borderColor: colors.background,
    },
  });
