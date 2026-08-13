import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/dealpulse/primary-button';
import { SecondaryButton } from '@/components/dealpulse/secondary-button';
import { TopAppBar } from '@/components/dealpulse/top-app-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useCreateAlert } from '@/state/alerts';

// No product-URL analyzer backend exists yet (see the Tier 0/1/2 plan discussed for
// ai/product_identifier.py). This simulates the "Analyze Product" step: Shopify-style
// `/products/...` URLs resolve successfully with a name derived from the slug (mirroring
// what a real JSON-LD/`.json`-endpoint lookup would find), anything else falls through to
// the manual-entry screen exactly like the Stitch design's failure state.
function mockAnalyze(url: string): { name: string; brand: string } | null {
  const match = url.match(/\/products\/([a-z0-9-]+)/i);
  if (!match) return null;
  const slug = match[1].replace(/-/g, ' ').trim();
  const name = slug.replace(/\b\w/g, (c) => c.toUpperCase());
  const hostMatch = url.match(/^https?:\/\/(?:www\.)?([^./]+)/i);
  const brand = hostMatch ? hostMatch[1].replace(/\b\w/g, (c) => c.toUpperCase()) : 'Unknown';
  return { name, brand };
}

export default function ProductUrlScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { updateDraft } = useCreateAlert();
  const [url, setUrl] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  const onAnalyze = () => {
    if (!url.trim()) return;
    setAnalyzing(true);
    setTimeout(() => {
      setAnalyzing(false);
      const result = mockAnalyze(url.trim());
      if (result) {
        updateDraft({
          productName: result.name,
          brandName: result.brand,
          productUrl: url.trim(),
          autoAnalyzeFailed: false,
        });
        router.push('/create-alert/configuration');
      } else {
        updateDraft({ productUrl: url.trim(), autoAnalyzeFailed: true });
        router.push('/create-alert/manual-entry');
      }
    }, 1200);
  };

  const onManualEntry = () => {
    updateDraft({ productUrl: url.trim() || null, autoAnalyzeFailed: false });
    router.push('/create-alert/manual-entry');
  };

  return (
    <ThemedView style={styles.container}>
      <TopAppBar title="Track Product" showBack hideProfile />
      <View style={styles.content}>
        <ThemedText type="title" style={styles.title}>
          Paste URL
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary" style={styles.subtitle}>
          We'll try to automatically identify the product, brand, price, and image to set up
          your tracking instantly.
        </ThemedText>

        <ThemedText type="label" themeColor="textSecondary" style={styles.fieldLabel}>
          PRODUCT URL
        </ThemedText>
        <View style={styles.urlBox}>
          <Ionicons name="link-outline" size={18} color="#6B7280" />
          <TextInput
            value={url}
            onChangeText={setUrl}
            placeholder="https://example.com/product"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={styles.input}
          />
        </View>

        <PrimaryButton
          label={analyzing ? 'Analyzing…' : 'Analyze Product'}
          icon={analyzing ? undefined : 'sparkles'}
          disabled={!url.trim() || analyzing}
          onPress={onAnalyze}
          style={styles.analyzeButton}
        />
        {analyzing && <ActivityIndicator color="#B7131A" style={styles.spinner} />}

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <ThemedText type="label" themeColor="textSecondary">
            OR
          </ThemedText>
          <View style={styles.dividerLine} />
        </View>

        <Pressable onPress={onManualEntry}>
          <SecondaryButton label="Enter Details Manually" icon="create-outline" />
        </Pressable>
      </View>
      <View style={{ height: insets.bottom }} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    gap: Spacing.two,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: Spacing.four,
  },
  fieldLabel: {
    letterSpacing: 0.5,
    marginBottom: Spacing.one,
  },
  urlBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    paddingHorizontal: Spacing.three,
    height: 52,
    marginBottom: Spacing.three,
  },
  input: {
    flex: 1,
    fontFamily: 'Montserrat_500Medium',
    fontSize: 14,
    color: '#171717',
  },
  analyzeButton: {
    marginTop: Spacing.one,
  },
  spinner: {
    marginTop: Spacing.two,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginVertical: Spacing.four,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#F0DADA',
  },
});
