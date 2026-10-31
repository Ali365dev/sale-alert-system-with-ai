import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  PermissionsAndroid,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';

import { REGIONS, SUPPORTED_CODES, DEFAULT_REGION } from '../../config/regions';
import regionStore from '../../state/regionStore';
import useOnboardingGateStore from '../../state/onboardingGateStore';
import { saveRegion } from '../../services/preferencesApi';
import { loadDeals } from '../../services/dealsService';
import Logo from '../../components/Logo';

const globeImage = require('../../assets/images/globe-location.png');
const logoIcon = require('../../assets/bootsplash/logo.png');

const SHOWN_CODES = ['PK', 'SA', 'AE', 'QA', 'KW', 'OM', 'BH', 'EG'];
const ALL_COUNTRIES = SHOWN_CODES.filter((c) => REGIONS[c]).map((code) => ({ code, ...REGIONS[code] }));


function CountryItem({ item, selected, onPress }) {
  return (
    <Pressable
      style={[styles.item, selected && styles.itemSelected]}
      onPress={() => onPress(item.code)}>
      <View style={styles.flagBox}>
        <Text style={styles.flagEmoji}>{item.flag}</Text>
      </View>
      <Text style={[styles.itemName, selected && styles.itemNameSelected]}>{item.name}</Text>
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
    </Pressable>
  );
}

async function requestLocationPermission() {
  if (Platform.OS !== 'android') return;
  try {
    await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      {
        title: 'Location Access',
        message: 'Allow Deals More to use your location to show relevant deals in your region.',
        buttonPositive: 'Allow',
        buttonNegative: 'Skip',
      },
    );
  } catch {
    // permission request failed — silently ignore
  }
}

export default function OnboardingCountryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const completeCountrySelection = useOnboardingGateStore((s) => s.completeCountrySelection);

  const detectedCode = regionStore.getState().regionCode || DEFAULT_REGION;
  const [selected, setSelected] = useState(detectedCode);
  const [search, setSearch] = useState('');

  useEffect(() => {
    requestLocationPermission();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return ALL_COUNTRIES;
    const q = search.toLowerCase();
    return ALL_COUNTRIES.filter((c) => c.name.toLowerCase().includes(q));
  }, [search]);

  const handleContinue = () => {
    regionStore.getState().setRegion(selected);
    saveRegion(selected);
    loadDeals(true); // clearCache — wipe old country's data before fetching new
    completeCountrySelection();
    navigation.navigate('OnboardingTopicsScreen');
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header — globe floats absolutely top-right, text flows left */}
      <View style={styles.header}>
        <Image source={globeImage} style={styles.globeImage} resizeMode="contain" />
        <View style={styles.logoRow}>
          <Image source={logoIcon} style={styles.logoIcon} resizeMode="contain" />
          <Logo size={20} />
        </View>
        <Text style={styles.title}>Select Your{'\n'}Country</Text>
        <Text style={styles.subtitle}>
          Choose your country to get the best deals, offers and discounts in your region.
        </Text>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <Icon name="search-outline" size={18} color="#9AA3B2" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search country..."
          placeholderTextColor="#9AA3B2"
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Country list */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.code}
        renderItem={({ item }) => (
          <CountryItem item={item} selected={selected === item.code} onPress={setSelected} />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />

      {/* Continue button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={({ pressed }) => [styles.continueBtn, pressed && styles.continueBtnPressed]}
          onPress={handleContinue}>
          <Text style={styles.continueBtnLabel}>Continue</Text>
          <Icon name="arrow-forward" size={20} color="#FFF" />
        </Pressable>
      </View>
    </View>
  );
}

const PRIMARY = '#E8344E';

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 20,
    minHeight: 180,
    backgroundColor: '#FFFFFF',
  },
  globeImage: {
    position: 'absolute',
    right: -10,
    top: -10,
    width: 175,
    height: 175,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
    marginRight: 170,
  },
  logoIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1A1A2E',
    lineHeight: 34,
    marginBottom: 10,
    marginRight: 150,
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 20,
    marginRight: 140,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 24,
    marginBottom: 12,
    backgroundColor: '#F0F2F8',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1A1A2E',
    ...Platform.select({ android: { includeFontPadding: false } }),
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    gap: 10,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F6F7FB',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  itemSelected: {
    borderColor: PRIMARY,
    backgroundColor: '#FFF5F7',
  },
  flagBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#ECEEF6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flagEmoji: { fontSize: 26 },
  itemName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  itemNameSelected: { color: PRIMARY },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: PRIMARY },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: PRIMARY,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#ECEEF5',
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: PRIMARY,
    borderRadius: 18,
    height: 56,
  },
  continueBtnPressed: { opacity: 0.88 },
  continueBtnLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFF',
  },
});
