import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Ionicons';
import { RADIUS, SPACING, TYPOGRAPHY } from '../styles/theme';
import { usePressScale } from '../hooks/usePressScale';

const SelectableCard = ({ label, icon, selected, onPress, iconVariant = 'plain', fullWidth }) => {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.97);

  return (
    <Animated.View style={[animatedStyle, fullWidth ? styles.wrapperFull : styles.wrapper]}>
      <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} style={[styles.card, selected && styles.cardSelected]}>
        {icon &&
          (iconVariant === 'circle' ? (
            <View style={[styles.iconCircle, selected && styles.iconCircleSelected]}>
              <Icon name={icon} size={22} color={selected ? '#FFFFFF' : '#57302D'} />
            </View>
          ) : (
            <Icon name={icon} size={26} color={selected ? '#FFFFFF' : '#B7131A'} />
          ))}
        <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
};

export default SelectableCard;

const styles = StyleSheet.create({
  wrapper: {
    width: '48%',
    marginBottom: SPACING.three,
  },
  wrapperFull: {
    width: '100%',
    marginBottom: SPACING.three,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: '#F0DADA',
    paddingVertical: SPACING.four,
    paddingHorizontal: SPACING.three,
    alignItems: 'center',
    gap: SPACING.two,
  },
  cardSelected: {
    backgroundColor: '#B7131A',
    borderColor: '#B7131A',
  },
  label: {
    ...TYPOGRAPHY.smallBold,
  },
  labelSelected: {
    color: '#FFFFFF',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleSelected: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
});
