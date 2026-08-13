import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/dealpulse/primary-button';
import { TopAppBar } from '@/components/dealpulse/top-app-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useCreateAlert } from '@/state/alerts';

function Field({
  label,
  required,
  ...props
}: {
  label: string;
  required?: boolean;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'numeric' | 'url';
}) {
  return (
    <View style={styles.field}>
      <ThemedText type="label" themeColor="textSecondary">
        {label}
        {required ? ' *' : ''}
      </ThemedText>
      <TextInput
        {...props}
        placeholderTextColor="#9CA3AF"
        style={styles.input}
        autoCapitalize={props.keyboardType === 'url' ? 'none' : 'sentences'}
      />
    </View>
  );
}

export default function ManualEntryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { draft, updateDraft } = useCreateAlert();

  const [productName, setProductName] = useState(draft.productName ?? '');
  const [brand, setBrand] = useState(draft.brandName ?? '');
  const [productUrl, setProductUrl] = useState(draft.productUrl ?? '');
  const [currentPrice, setCurrentPrice] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');

  const valid = productName.trim() && brand.trim() && productUrl.trim();

  const onContinue = () => {
    updateDraft({
      productName: productName.trim(),
      brandName: brand.trim(),
      productUrl: productUrl.trim(),
      currentPrice: currentPrice.trim() ? Number(currentPrice) : null,
      originalPrice: originalPrice.trim() ? Number(originalPrice) : null,
    });
    router.push('/create-alert/configuration');
  };

  return (
    <ThemedView style={styles.container}>
      <TopAppBar title="Manual Entry" showBack hideProfile />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {draft.autoAnalyzeFailed && (
          <View style={styles.warningBanner}>
            <Ionicons name="warning-outline" size={20} color="#B7131A" />
            <View style={styles.warningText}>
              <ThemedText type="smallBold" style={styles.warningTitle}>
                We couldn't automatically identify this product
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Some websites don't provide structured product information. Please enter the
                details manually below to create your alert.
              </ThemedText>
            </View>
          </View>
        )}

        <Field
          label="Product Name"
          required
          value={productName}
          onChangeText={setProductName}
          placeholder="e.g. Sony WH-1000XM5"
        />
        <Field label="Brand" required value={brand} onChangeText={setBrand} placeholder="e.g. Sony" />
        <Field
          label="Product URL"
          required
          value={productUrl}
          onChangeText={setProductUrl}
          placeholder="https://example-shop.com/product"
          keyboardType="url"
        />

        <View style={styles.priceRow}>
          <View style={styles.priceField}>
            <ThemedText type="label" themeColor="textSecondary">
              Current Price (optional)
            </ThemedText>
            <TextInput
              value={currentPrice}
              onChangeText={setCurrentPrice}
              placeholder="$0.00"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
              style={styles.input}
            />
          </View>
          <View style={styles.priceField}>
            <ThemedText type="label" themeColor="textSecondary">
              Original Price (optional)
            </ThemedText>
            <TextInput
              value={originalPrice}
              onChangeText={setOriginalPrice}
              placeholder="$0.00"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
              style={styles.input}
            />
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.three }]}>
        <PrimaryButton label="Continue" icon="arrow-forward" disabled={!valid} onPress={onContinue} />
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
    gap: Spacing.three,
  },
  warningBanner: {
    flexDirection: 'row',
    gap: Spacing.two,
    backgroundColor: '#FBDCDC',
    borderRadius: Radius.card,
    padding: Spacing.three,
    marginBottom: Spacing.two,
  },
  warningText: {
    flex: 1,
    gap: 2,
  },
  warningTitle: {
    color: '#B7131A',
  },
  field: {
    gap: Spacing.one,
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
  priceRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  priceField: {
    flex: 1,
    gap: Spacing.one,
  },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: '#F0DADA',
  },
});
