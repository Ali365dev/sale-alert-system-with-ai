import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { SPACING, TYPOGRAPHY } from '../styles/theme';
import useTheme from '../hooks/useTheme';
import useDataStore from '../state/dataStore';
import Logo from './Logo';

const TopAppBar = ({ title, showBack, onBack, hideSearch, hideProfile, rightIcon, onPressRight }) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const unreadCount = useDataStore((state) => state.alerts.filter((a) => !a.read).length);

  return (
    <View style={[styles.bar, { paddingTop: insets.top + SPACING.two }]}>
      <View style={styles.side}>
        {showBack ? (
          <Pressable hitSlop={8} onPress={onBack ?? (() => navigation.goBack())}>
            <Icon name="chevron-back" size={24} color={colors.text} />
          </Pressable>
        ) : (
          !hideSearch && (
            <Pressable hitSlop={8} onPress={() => navigation.dispatch(DrawerActions.openDrawer())}>
              <Icon name="menu-outline" size={26} color={colors.text} />
            </Pressable>
          )
        )}
      </View>

      {title ? <Text style={styles.title}>{title}</Text> : <Logo size={20} />}

      <View style={[styles.side, styles.sideRight]}>
        {rightIcon ? (
          <Pressable hitSlop={8} onPress={onPressRight}>
            <Icon name={rightIcon} size={22} color={colors.text} />
          </Pressable>
        ) : (
          !hideProfile && (
            <Pressable hitSlop={8} onPress={() => navigation.navigate('NotificationsScreen')} style={styles.bellWrap}>
              <Icon name="notifications-outline" size={23} color={colors.text} />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeLabel}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
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
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    side: {
      width: 60,
      flexDirection: 'row',
      gap: SPACING.three,
    },
    sideRight: {
      justifyContent: 'flex-end',
    },
    title: {
      ...TYPOGRAPHY.headline,
      flex: 1,
      textAlign: 'center',
      color: colors.primary,
    },
    bellWrap: {
      position: 'relative',
    },
    badge: {
      position: 'absolute',
      top: -5,
      right: -7,
      minWidth: 17,
      height: 17,
      borderRadius: 9,
      paddingHorizontal: 3,
      backgroundColor: colors.primary,
      borderWidth: 1.5,
      borderColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: '#FFFFFF',
    },
  });
