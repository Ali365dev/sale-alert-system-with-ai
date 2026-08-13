import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FilterChip } from '@/components/dealpulse/filter-chip';
import { PrimaryButton } from '@/components/dealpulse/primary-button';
import { ProductPreviewCard } from '@/components/dealpulse/product-preview-card';
import { TopAppBar } from '@/components/dealpulse/top-app-bar';
import { ToggleRow } from '@/components/dealpulse/toggle-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useAlerts, useCreateAlert } from '@/state/alerts';
import { AlertCondition } from '@/types/dealpulse';

const CONDITIONS: { key: AlertCondition; label: string }[] = [
  { key: 'any_sale', label: 'Any sale' },
  { key: '10_off', label: '10% or more off' },
  { key: '20_off', label: '20% or more off' },
  { key: '30_off', label: '30% or more off' },
  { key: 'custom', label: 'Custom discount' },
  { key: 'price_below', label: 'Price drops below' },
];

export default function ConfigurationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { draft, updateDraft } = useCreateAlert();
  const { addAlert } = useAlerts();

  const needsValue = draft.condition === 'custom' || draft.condition === 'price_below';
  const valid = !needsValue || (draft.conditionValue != null && draft.conditionValue > 0);
  const hasChannel = draft.channels.push || draft.channels.email || draft.channels.inApp;

  const onReviewAlert = () => {
    const created = addAlert({
      type: draft.type ?? 'brand',
      brandId: draft.brandId,
      brandName: draft.brandName,
      productName: draft.productName,
      productUrl: draft.productUrl,
      image: draft.image,
      currentPrice: draft.currentPrice,
      originalPrice: draft.originalPrice,
      condition: draft.condition,
      conditionValue: draft.conditionValue,
      channels: draft.channels,
    });
    router.push({ pathname: '/create-alert/review', params: { id: created.id } });
  };

  return (
    <ThemedView style={styles.container}>
      <TopAppBar title="Sale Alerts" showBack hideProfile />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {draft.type === 'product' && draft.productName && (
          <ProductPreviewCard
            image={draft.image}
            name={draft.productName}
            brandName={draft.brandName}
            currentPrice={draft.currentPrice}
            originalPrice={draft.originalPrice}
          />
        )}

        <ThemedText type="subtitle" style={styles.sectionTitle}>
          When should we alert you?
        </ThemedText>
        <View style={styles.chipWrap}>
          {CONDITIONS.map((c) => (
            <FilterChip
              key={c.key}
              label={c.label}
              selected={draft.condition === c.key}
              onPress={() => updateDraft({ condition: c.key, conditionValue: null })}
            />
          ))}
        </View>

        {needsValue && (
          <View style={styles.valueField}>
            <ThemedText type="label" themeColor="textSecondary">
              {draft.condition === 'custom' ? 'Discount % (e.g. 25)' : 'Target price ($)'}
            </ThemedText>
            <TextInput
              value={draft.conditionValue != null ? String(draft.conditionValue) : ''}
              onChangeText={(t) => updateDraft({ conditionValue: t.trim() ? Number(t) : null })}
              placeholder={draft.condition === 'custom' ? '25' : '99.00'}
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
              style={styles.input}
            />
          </View>
        )}

        <ThemedText type="subtitle" style={styles.sectionTitle}>
          How should we notify you?
        </ThemedText>
        <View style={styles.toggleList}>
          <ToggleRow
            icon="notifications-outline"
            label="Push notification"
            checked={draft.channels.push}
            onPress={() => updateDraft({ channels: { ...draft.channels, push: !draft.channels.push } })}
          />
          <ToggleRow
            icon="mail-outline"
            label="Email"
            checked={draft.channels.email}
            onPress={() => updateDraft({ channels: { ...draft.channels, email: !draft.channels.email } })}
          />
          <ToggleRow
            icon="phone-portrait-outline"
            label="In-app"
            checked={draft.channels.inApp}
            onPress={() => updateDraft({ channels: { ...draft.channels, inApp: !draft.channels.inApp } })}
          />
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.three }]}>
        <PrimaryButton label="Review Alert" disabled={!valid || !hasChannel} onPress={onReviewAlert} />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.two,
  },
  sectionTitle: {
    marginTop: Spacing.three,
    marginBottom: Spacing.one,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  valueField: {
    gap: Spacing.one,
    marginTop: Spacing.three,
  },
  input: {
    backgroundColor: '#F8F9FB',
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: '#F0DADA',
    paddingHorizontal: Spacing.three,
    height: 48,
    fontFamily: 'Montserrat_500Medium',
    fontSize: 14,
    color: '#171717',
  },
  toggleList: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: '#F0DADA',
    overflow: 'hidden',
  },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: '#F0DADA',
  },
});
