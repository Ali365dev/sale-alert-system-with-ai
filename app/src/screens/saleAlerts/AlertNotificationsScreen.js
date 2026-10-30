import { useMemo, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Screen from '../../components/Screen';
import TopAppBar from '../../components/TopAppBar';
import PrimaryButton from '../../components/PrimaryButton';
import OnboardingProgress from '../../components/OnboardingProgress';
import { RADIUS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import useTheme from '../../hooks/useTheme';
import useCreateAlertDraftStore from '../../state/createAlertDraftStore';
import useNotificationPrefsStore from '../../state/notificationPrefsStore';
import { validateAlertNotifications } from '../../utils/saleAlertValidation';
import { showErrorToast } from '../../utils/CustomToast';

const Row = ({ label, value, onChange, styles, colors, hint }) => (
  <View style={styles.row}>
    <View style={styles.rowText}>
      <Text style={styles.rowLabel}>{label}</Text>
      {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
    </View>
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ false: colors.border, true: colors.primary }}
      thumbColor={colors.white}
    />
  </View>
);

const AlertNotificationsScreen = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const draft = useCreateAlertDraftStore();
  const setField = useCreateAlertDraftStore((s) => s.setField);
  const pushEnabled = useNotificationPrefsStore((s) => s.pushEnabled);
  const priceDropAlerts = useNotificationPrefsStore((s) => s.priceDropAlerts);
  const [push, setPush] = useState(draft.editingAlertId ? draft.notifyPush : draft.notifyPush && pushEnabled);
  const [email, setEmail] = useState(draft.notifyEmail);
  const [inApp, setInApp] = useState(draft.editingAlertId ? draft.notifyInApp : draft.notifyInApp && priceDropAlerts);
  const [error, setError] = useState('');

  const onContinue = () => {
    const result = validateAlertNotifications({
      notifyPush: push,
      notifyEmail: email,
      notifyInApp: inApp,
    });
    if (!result.ok) {
      setError(result.error);
      showErrorToast(result.error);
      return;
    }
    setError('');
    setField('notifyPush', push);
    setField('notifyEmail', email);
    setField('notifyInApp', inApp);
    navigation.navigate('ReviewAlertScreen');
  };

  return (
    <Screen style={styles.root}>
      <TopAppBar title="Notifications" showBack hideProfile />
      <View style={styles.body}>
        <OnboardingProgress step={3} total={5} />
        <Text style={styles.heading}>How should we notify you?</Text>
        <Text style={styles.sub}>
          Defaults follow your Notification Preferences. You may adjust them for this alert.
        </Text>
        <Row
          label="Push notification"
          hint={pushEnabled ? 'Enabled in preferences' : 'Off in preferences'}
          value={push}
          onChange={(v) => {
            setPush(v);
            if (error) setError('');
          }}
          styles={styles}
          colors={colors}
        />
        <Row
          label="Email notification"
          value={email}
          onChange={(v) => {
            setEmail(v);
            if (error) setError('');
          }}
          styles={styles}
          colors={colors}
        />
        <Row
          label="In-app notification"
          hint={priceDropAlerts ? 'Price-drop alerts on' : 'Price-drop alerts off'}
          value={inApp}
          onChange={(v) => {
            setInApp(v);
            if (error) setError('');
          }}
          styles={styles}
          colors={colors}
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <PrimaryButton label="Continue" onPress={onContinue} style={{ marginTop: SPACING.three }} />
      </View>
    </Screen>
  );
};

export default AlertNotificationsScreen;

const createStyles = (colors) =>
  StyleSheet.create({
    root: { flex: 1 },
    body: { padding: SPACING.four, gap: SPACING.three },
    heading: { ...TYPOGRAPHY.headline, color: colors.text, marginTop: SPACING.two },
    sub: { ...TYPOGRAPHY.small, color: colors.textSecondary },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderRadius: RADIUS.button,
      paddingHorizontal: SPACING.three,
      paddingVertical: SPACING.three,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    rowText: { flex: 1, paddingRight: SPACING.two, gap: 2 },
    rowLabel: { ...TYPOGRAPHY.default, color: colors.text },
    rowHint: { ...TYPOGRAPHY.small, fontSize: 12, color: colors.textSecondary },
    errorText: { ...TYPOGRAPHY.small, color: colors.error },
  });
