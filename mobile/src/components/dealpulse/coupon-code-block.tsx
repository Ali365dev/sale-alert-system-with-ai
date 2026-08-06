import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';

export function CouponCodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <View style={styles.container}>
      <View style={styles.codeSide}>
        <ThemedText type="label" themeColor="textSecondary" style={styles.promoLabel}>
          PROMO CODE
        </ThemedText>
        <ThemedText type="headline" style={styles.code}>
          {code}
        </ThemedText>
      </View>
      <Pressable onPress={onCopy} style={styles.copyButton}>
        <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color="#FFFFFF" />
        <ThemedText type="label" style={styles.copyLabel}>
          {copied ? 'Copied' : 'Copy'}
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FB',
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    padding: Spacing.three,
  },
  codeSide: {
    gap: 2,
  },
  promoLabel: {
    letterSpacing: 0.5,
  },
  code: {
    letterSpacing: 1,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#B7131A',
    borderRadius: Radius.chip,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  copyLabel: {
    color: '#FFFFFF',
  },
});
