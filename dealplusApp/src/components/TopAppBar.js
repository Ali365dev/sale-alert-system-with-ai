import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { COLORS, SPACING, TYPOGRAPHY } from '../styles/theme';

const TopAppBar = ({ title = 'DealPulse', showBack, onBack, hideSearch, hideProfile, rightIcon, onPressRight }) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingTop: insets.top + SPACING.two }]}>
      <View style={styles.side}>
        {showBack ? (
          <Pressable hitSlop={8} onPress={onBack ?? (() => navigation.goBack())}>
            <Icon name="chevron-back" size={24} color="#171717" />
          </Pressable>
        ) : (
          !hideSearch && (
            <Pressable hitSlop={8} onPress={() => navigation.navigate('Search')}>
              <Icon name="search" size={22} color="#B7131A" />
            </Pressable>
          )
        )}
      </View>

      <Text style={styles.wordmark}>{title}</Text>

      <View style={[styles.side, styles.sideRight]}>
        {rightIcon ? (
          <Pressable hitSlop={8} onPress={onPressRight}>
            <Icon name={rightIcon} size={22} color="#171717" />
          </Pressable>
        ) : (
          !hideProfile && (
            <Pressable hitSlop={8} onPress={() => navigation.navigate('Profile')}>
              <Icon name="person-circle-outline" size={24} color="#B7131A" />
            </Pressable>
          )
        )}
      </View>
    </View>
  );
};

export default TopAppBar;

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.four,
    paddingBottom: SPACING.two,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  side: {
    width: 60,
    flexDirection: 'row',
    gap: SPACING.three,
  },
  sideRight: {
    justifyContent: 'flex-end',
  },
  wordmark: {
    ...TYPOGRAPHY.headline,
    flex: 1,
    textAlign: 'center',
    color: '#B7131A',
  },
});
