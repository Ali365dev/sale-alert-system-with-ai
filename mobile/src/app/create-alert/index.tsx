import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OptionCard } from '@/components/dealpulse/option-card';
import { PrimaryButton } from '@/components/dealpulse/primary-button';
import { TopAppBar } from '@/components/dealpulse/top-app-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useCreateAlert } from '@/state/alerts';

export default function CreateAlertSelectionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { draft, updateDraft } = useCreateAlert();

  const choose = (type: 'product' | 'brand') => updateDraft({ type });

  const onContinue = () => {
    if (draft.type === 'brand') router.push('/create-alert/pick-brand');
    else router.push('/create-alert/product-url');
  };

  return (
    <ThemedView style={styles.container}>
      <TopAppBar title="DealPulse" showBack hideProfile />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ThemedText type="title" style={styles.title}>
          What do you want to track?
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary" style={styles.subtitle}>
          Select the type of alert you want to create.
        </ThemedText>

        <View style={styles.options}>
          <OptionCard
            icon="pricetag-outline"
            title="Track a Product"
            subtitle="Get notified when a specific product goes on sale."
            selected={draft.type === 'product'}
            onPress={() => choose('product')}
          />
          <OptionCard
            icon="business-outline"
            title="Track a Brand"
            subtitle="Get notified whenever this brand has a sale or promotion."
            selected={draft.type === 'brand'}
            onPress={() => choose('brand')}
          />
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.three }]}>
        <PrimaryButton label="Continue" pill disabled={!draft.type} onPress={onContinue} />
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
  options: {
    gap: Spacing.three,
  },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: '#F0DADA',
  },
});
