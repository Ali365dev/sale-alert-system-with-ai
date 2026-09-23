import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { SPACING, TYPOGRAPHY } from '../styles/theme';
import useTheme from '../hooks/useTheme';
import useDataStore from '../state/dataStore';

const TopAppBar = ({ title, showBack, onBack, hideProfile, hideBorder, rightIcon, onPressRight, rightSlot, titleAlign = 'center', style }) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const unreadCount = useDataStore((state) => state.alerts.filter((a) => !a.read).length);
  const titleStart = titleAlign === 'left' || titleAlign === 'start';

  return (
    <View style={[styles.bar, { paddingTop: insets.top + SPACING.two }, hideBorder && styles.barNoBorder, style]}>
      <View style={[styles.side, titleStart && styles.sideHug]}>
        {showBack ? (
          <Pressable hitSlop={8} onPress={onBack ?? (() => navigation.goBack())}>
            <Icon name="chevron-back" size={24} color={colors.text} />
          </Pressable>
        ) : null}
      </View>

      {title ? <Text style={[styles.title, titleStart && styles.titleStart]}>{title}</Text> : <View style={styles.titleSpacer} />}

      <View style={[styles.side, styles.sideRight, rightSlot && styles.sideRightWide]}>
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
    sideRight: {
      justifyContent: 'flex-end',
    },
    sideRightWide: {
      width: 96,
      zIndex: 2,
      gap: 4,
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
      paddingLeft: 4,
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
