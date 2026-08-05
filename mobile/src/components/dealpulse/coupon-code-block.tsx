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
    <Pressable onPress={onCopy} style={styles.container}>
      <View style={styles.codeSide}>
        <ThemedText type="small" themeColor="textSecondary">
          Promo code
        </ThemedText>
        <ThemedText type="title" style={styles.code}>
          {code}
        </ThemedText>
      </View>
      <View style={styles.divider} />
      <View style={styles.copySide}>
        <Ionicons
          name={copied ? 'checkmark-circle' : 'copy-outline'}
          size={20}
          color={copied ? '#16A34A' : '#171717'}
        />
        <ThemedText type="smallBold" style={copied ? styles.copiedLabel : undefined}>
          {copied ? 'Copied' : 'Copy'}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    padding: Spacing.three,
  },
  codeSide: {
    flex: 1,
    gap: 2,
  },
  code: {
    fontSize: 20,
    letterSpacing: 1,
  },
  divider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: '#E5E7EB',
    marginHorizontal: Spacing.three,
  },
  copySide: {
    alignItems: 'center',
    gap: 4,
  },
  copiedLabel: {
    color: '#16A34A',
  },
});
