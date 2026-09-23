import { useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { RADIUS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import useTheme from '../../hooks/useTheme';
import useDataStore from '../../state/dataStore';
import { requestBrand } from '../../services/brandRequestApi';
import { showErrorToast } from '../../utils/CustomToast';
import CategoryPickerSheet from '../../components/CategoryPickerSheet';
import Logo from '../../components/Logo';
import PrimaryButton from '../../components/PrimaryButton';

const URL_PATTERN = /^(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+([/?#].*)?$/i;

function FieldInput({ icon, error, colors, styles, ...props }) {
  return (
    <View>
      <View style={[styles.fieldRow, error && styles.fieldRowError]}>
        <Icon name={icon} size={18} color={colors.textSecondary} style={styles.fieldIcon} />
        <TextInput
          placeholderTextColor={colors.textSecondary}
          style={styles.fieldInput}
          autoCorrect={false}
          autoComplete="off"
          spellCheck={false}
          {...props}
        />
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

function OutlineButton({ label, icon, onPress, colors, styles }) {
  return (
    <Pressable style={styles.outlineButton} onPress={onPress}>
      {icon && <Icon name={icon} size={17} color={colors.primary} />}
      <Text style={styles.outlineButtonLabel}>{label}</Text>
    </Pressable>
  );
}

const RequestBrandScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const categories = useDataStore((state) => state.categories);
  const categorySheetRef = useRef(null);

  const [brandName, setBrandName] = useState(route.params?.brandName ?? '');
  const [website, setWebsite] = useState('');
  const [category, setCategory] = useState(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({});

  const resetForm = () => {
    setBrandName('');
    setWebsite('');
    setCategory(null);
    setNote('');
    setErrors({});
    setSubmitted(false);
  };

  const validate = () => {
    const name = brandName.trim();
    const site = website.trim();
    const next = {};

    if (!name) {
      next.brandName = 'Brand name is required.';
    } else if (name.length < 2) {
      next.brandName = 'Brand name must be at least 2 characters.';
    } else if (name.length > 255) {
      next.brandName = 'Brand name is too long.';
    }

    if (site && !URL_PATTERN.test(site)) {
      next.website = 'Enter a valid website, e.g. https://example.com';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (submitting || !validate()) return;
    setSubmitting(true);
    const name = brandName.trim();
    const combinedNote = [website.trim() ? `Website: ${website.trim()}` : null, note.trim() || null].filter(Boolean).join('\n');
    const ok = await requestBrand({ brandName: name, category, note: combinedNote });
    setSubmitting(false);
    if (ok) {
      setSubmitted(true);
    } else {
      showErrorToast("Couldn't send your request. Please check your connection and try again.");
    }
  };

  if (submitted) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + SPACING.three }]}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
            <Icon name="close" size={24} color={colors.text} />
          </Pressable>
          <Logo size={18} />
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.successWrap}>
          <View style={styles.glowOuter}>
            <View style={styles.glowInner}>
              <View style={styles.successIconCircle}>
                <Icon name="checkmark" size={40} color="#FFFFFF" />
              </View>
            </View>
          </View>
          <Text style={styles.successTitle}>Request Received!</Text>
          <Text style={styles.successBody}>
            Thank you for helping us grow. We've added <Text style={styles.bold}>{brandName.trim()}</Text> to our
            wishlist and will notify you if they join DealPulse.
          </Text>
          <PrimaryButton
            label="Back to Home"
            onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}
            style={styles.fullWidthButton}
          />
          <OutlineButton label="Request Another Brand" icon="add-circle-outline" onPress={resetForm} colors={colors} styles={styles} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + SPACING.three }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Icon name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Logo size={18} />
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.five }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <View style={styles.heroIconCircle}>
          <Icon name="storefront" size={36} color="#FFFFFF" />
        </View>
        <Text style={styles.title}>Request a Brand</Text>
        <Text style={styles.subtitle}>
          Can't find your favorite brand? Let us know and we'll work on bringing their deals to you!
        </Text>

        <View style={styles.card}>
          <View style={styles.field}>
            <Text style={styles.label}>
              Brand Name <Text style={styles.required}>*</Text>
            </Text>
            <FieldInput
              icon="pricetag-outline"
              value={brandName}
              onChangeText={(v) => {
                setBrandName(v);
                if (errors.brandName) setErrors((e) => ({ ...e, brandName: undefined }));
              }}
              placeholder="e.g., Acme Corp"
              error={errors.brandName}
              colors={colors}
              styles={styles}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Website (Optional)</Text>
            <FieldInput
              icon="link-outline"
              value={website}
              onChangeText={(v) => {
                setWebsite(v);
                if (errors.website) setErrors((e) => ({ ...e, website: undefined }));
              }}
              placeholder="https://www.example.com"
              keyboardType="url"
              autoCapitalize="none"
              error={errors.website}
              colors={colors}
              styles={styles}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Category</Text>
            <Pressable
              style={styles.fieldRow}
              onPress={() => categorySheetRef.current?.present()}
              accessibilityRole="button"
              accessibilityLabel="Select a category">
              <Icon name="storefront-outline" size={18} color={colors.textSecondary} style={styles.fieldIcon} />
              <Text style={[styles.fieldValue, !category && styles.placeholderText]} numberOfLines={1}>
                {category ?? 'Select a category'}
              </Text>
              <Icon name="chevron-down" size={16} color={colors.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Reason for Request (Optional)</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Why do you want to see deals from this brand?"
              placeholderTextColor={colors.textSecondary}
              style={styles.noteInput}
              multiline
              autoCorrect={false}
              spellCheck={false}
            />
          </View>

          <PrimaryButton
            label={submitting ? 'Submitting...' : 'Submit Request'}
            icon="paper-plane-outline"
            pill
            disabled={!brandName.trim() || submitting}
            onPress={handleSubmit}
          />

          <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.checkExistingWrap}>
            <Text style={styles.checkExistingLabel}>Check existing brands</Text>
          </Pressable>
        </View>
      </ScrollView>

      <CategoryPickerSheet ref={categorySheetRef} categories={categories} selected={category} onSelect={setCategory} />
    </KeyboardAvoidingView>
  );
};

export default RequestBrandScreen;

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.four,
      paddingBottom: SPACING.three,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerSpacer: {
      width: 24,
    },
    content: {
      paddingHorizontal: SPACING.four,
      paddingTop: SPACING.five,
      alignItems: 'center',
    },
    heroIconCircle: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.three,
    },
    title: {
      ...TYPOGRAPHY.title,
      color: colors.text,
      textAlign: 'center',
    },
    subtitle: {
      ...TYPOGRAPHY.default,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: SPACING.two,
      marginBottom: SPACING.five,
      paddingHorizontal: SPACING.two,
    },
    card: {
      alignSelf: 'stretch',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.card,
      padding: SPACING.four,
      gap: SPACING.four,
    },
    field: {
      gap: SPACING.two,
    },
    label: {
      ...TYPOGRAPHY.smallBold,
      color: colors.text,
    },
    required: {
      color: colors.primary,
    },
    fieldRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.two,
      backgroundColor: colors.backgroundElement,
      borderBottomWidth: 1.5,
      borderBottomColor: colors.textSecondary,
      borderTopLeftRadius: 8,
      borderTopRightRadius: 8,
      paddingHorizontal: SPACING.three,
      height: 50,
    },
    fieldRowError: {
      borderBottomColor: colors.primary,
    },
    fieldIcon: {
      flexGrow: 0,
      flexShrink: 0,
    },
    errorText: {
      ...TYPOGRAPHY.small,
      color: colors.primary,
      marginTop: SPACING.one,
    },
    fieldInput: {
      flex: 1,
      alignSelf: 'stretch',
      fontSize: 15,
      fontWeight: '500',
      color: colors.text,
      paddingVertical: 0,
      paddingHorizontal: 0,
      margin: 0,
      ...Platform.select({
        ios: { lineHeight: 18 },
        android: { textAlignVertical: 'center', includeFontPadding: false },
      }),
    },
    fieldValue: {
      flex: 1,
      fontSize: 15,
      fontWeight: '500',
      color: colors.text,
    },
    placeholderText: {
      color: colors.textSecondary,
    },
    noteInput: {
      backgroundColor: colors.backgroundElement,
      borderBottomWidth: 1.5,
      borderBottomColor: colors.textSecondary,
      borderTopLeftRadius: 8,
      borderTopRightRadius: 8,
      paddingHorizontal: SPACING.three,
      paddingVertical: SPACING.three,
      minHeight: 88,
      fontSize: 15,
      fontWeight: '500',
      color: colors.text,
      textAlignVertical: 'top',
    },
    checkExistingWrap: {
      alignItems: 'center',
      paddingTop: SPACING.one,
    },
    checkExistingLabel: {
      ...TYPOGRAPHY.smallBold,
      color: colors.textSecondary,
    },
    successWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: SPACING.six,
      gap: SPACING.three,
    },
    glowOuter: {
      width: 220,
      height: 220,
      borderRadius: 110,
      backgroundColor: 'rgba(225,29,72,0.06)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.two,
    },
    glowInner: {
      width: 150,
      height: 150,
      borderRadius: 75,
      backgroundColor: 'rgba(225,29,72,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    successIconCircle: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    successTitle: {
      ...TYPOGRAPHY.title,
      color: colors.text,
    },
    successBody: {
      ...TYPOGRAPHY.default,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    bold: {
      fontWeight: '700',
      color: colors.text,
    },
    fullWidthButton: {
      alignSelf: 'stretch',
      marginTop: SPACING.three,
    },
    outlineButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.two,
      alignSelf: 'stretch',
      borderWidth: 1.5,
      borderColor: colors.primary,
      borderRadius: RADIUS.chip,
      paddingVertical: SPACING.three - 2,
    },
    outlineButtonLabel: {
      ...TYPOGRAPHY.label,
      color: colors.primary,
      fontSize: 15,
    },
  });
