import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

const Divider = () => (
  <View style={styles.dividerRow}>
    <View style={styles.hr} />
    <Text style={styles.hrLabel}>or</Text>
    <View style={styles.hr} />
  </View>
);

type Social = 'Apple' | 'Google' | 'GitHub' | 'Instagram' | 'Twitter' | 'Facebook';

const ICON: Record<Social, keyof typeof Ionicons.glyphMap> = {
  Apple: 'logo-apple',
  Google: 'logo-google',
  GitHub: 'logo-github',
  Instagram: 'logo-instagram',
  Twitter: 'logo-twitter',
  Facebook: 'logo-facebook',
};

const SocialButton = ({
  label,
  onPress,
  disabled,
}: {
  label: Social | 'Use phone or email';
  onPress: () => void;
  disabled?: boolean;
}) => (
  <TouchableOpacity style={styles.listButton} activeOpacity={0.8} onPress={onPress} disabled={disabled}>
    {label === 'Use phone or email' ? (
      <Ionicons name="person-add-outline" size={20} color="#111827" />
    ) : (
      <Ionicons name={ICON[label as Social]} size={20} color="#111827" />
    )}
    <Text style={styles.listButtonText}>
      {label === 'Use phone or email' ? 'Use phone or email' : `Continue with ${label}`}
    </Text>
    <Ionicons name="chevron-forward" size={18} color="#6b7280" />
  </TouchableOpacity>
);

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

const RegisterScreen: React.FC<Props> = ({ navigation }) => {
  const [contactMethod, setContactMethod] = useState<'email' | 'phone'>('email');
  const [contactValue, setContactValue] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [step, setStep] = useState<'contact' | 'verify' | 'password'>('contact');
  const [busy, setBusy] = useState(false);

  const resetState = () => {
    setContactMethod('email');
    setContactValue('');
    setVerificationCode('');
    setPassword('');
    setConfirmPassword('');
    setStep('contact');
    setBusy(false);
  };

  const primaryDisabled = useMemo(() => {
    if (busy) return true;
    if (step === 'contact') {
      if (!contactValue.trim()) {
        return true;
      }
      if (contactMethod === 'email') {
        return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactValue.trim());
      }
      return contactValue.replace(/\D/g, '').length < 10;
    }
    if (step === 'verify') {
      return verificationCode.trim().length !== 6;
    }
    if (!password || !confirmPassword) {
      return true;
    }
    if (password !== confirmPassword) {
      return true;
    }
    if (password.length < 8) {
      return true;
    }
    return false;
  }, [busy, step, contactMethod, contactValue, verificationCode, password, confirmPassword]);

  const handleSocial = (provider: Social) => {
    Alert.alert(`Continue with ${provider}`, 'Single sign-on is coming soon.');
  };

  const handleSendCode = () => {
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      setStep('verify');
      Alert.alert(
        'Verification code sent',
        contactMethod === 'email'
          ? `We emailed a 6-digit code to ${contactValue.trim()}.`
          : `We texted a 6-digit code to ${contactValue.trim()}.`,
      );
    }, 600);
  };

  const handleVerifyCode = () => {
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      Alert.alert('Code verified', 'Great! Let’s finish setting up your password.', [
        {
          text: 'Continue',
          onPress: () => setStep('password'),
        },
      ]);
    }, 400);
  };

  const handleSubmit = () => {
    setBusy(true);
    Alert.alert('Create an account', 'Registration is not yet available in this preview build.', [
      {
        text: 'OK',
        onPress: () => {
          setBusy(false);
          resetState();
          setShowForm(false);
        },
      },
    ]);
  };

  const handlePrimaryAction = () => {
    if (step === 'contact') {
      handleSendCode();
    } else if (step === 'verify') {
      handleVerifyCode();
    } else {
      handleSubmit();
    }
  };

  const renderTabs = () => (
    <View style={styles.tabRow}>
      {(['email', 'phone'] as const).map((method) => (
        <TouchableOpacity
          key={method}
          style={[styles.tabButton, contactMethod === method && styles.tabButtonActive]}
          onPress={() => {
            setContactMethod(method);
            setContactValue('');
          }}
          disabled={busy}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabLabel, contactMethod === method && styles.tabLabelActive]}>
            {method === 'email' ? 'Email' : 'Phone number'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <LinearGradient colors={["#ffffff", "#f3f4f6"]} style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" bounces={false}>
          <View style={styles.header}>
            <Text style={styles.brand}>Ethos</Text>
            <Text style={styles.tagline}>Guild quests on the go.</Text>
          </View>

          {!showForm && (
            <View style={styles.card}>
              <SocialButton label="Use phone or email" onPress={() => setShowForm(true)} disabled={busy} />
              <SocialButton label="Apple" onPress={() => handleSocial('Apple')} disabled={busy} />
              <SocialButton label="Google" onPress={() => handleSocial('Google')} disabled={busy} />
              <SocialButton label="GitHub" onPress={() => handleSocial('GitHub')} disabled={busy} />
              <SocialButton label="Instagram" onPress={() => handleSocial('Instagram')} disabled={busy} />
              <SocialButton label="Facebook" onPress={() => handleSocial('Facebook')} disabled={busy} />
              <Divider />
              <TouchableOpacity style={styles.ghostButton} onPress={() => navigation.navigate('Login')} disabled={busy}>
                <Text style={styles.ghostButtonText}>I already have an account</Text>
              </TouchableOpacity>
            </View>
          )}

          {showForm && (
            <View style={styles.card}>
              <View style={styles.formHeaderRow}>
                <TouchableOpacity
                  onPress={() => {
                    setShowForm(false);
                    resetState();
                  }}
                  hitSlop={8}
                >
                  <Ionicons name="chevron-back" size={22} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.formTitle}>Use phone or email</Text>
                <View style={{ width: 22 }} />
              </View>

              {step === 'contact' && (
                <>
                  {renderTabs()}

                  <Text style={styles.label}>
                    {contactMethod === 'email' ? 'Email address' : 'Phone number'}
                  </Text>
                  <TextInput
                    value={contactValue}
                    onChangeText={setContactValue}
                    autoCapitalize="none"
                    keyboardType={contactMethod === 'email' ? 'email-address' : 'phone-pad'}
                    placeholder={contactMethod === 'email' ? 'you@example.com' : '+1 (555) 123-4567'}
                    placeholderTextColor="#9ca3af"
                    style={styles.input}
                    returnKeyType="done"
                    onSubmitEditing={primaryDisabled ? undefined : handleSendCode}
                  />
                </>
              )}

              {step === 'verify' && (
                <>
                  <Text style={styles.infoText}>
                    {contactMethod === 'email'
                      ? `We sent a 6-digit code to ${contactValue.trim()}.
Please check your inbox to continue.`
                      : `We sent a 6-digit code to ${contactValue.trim()}.
It may take a moment to arrive.`}
                  </Text>

                  <Text style={styles.label}>Enter verification code</Text>
                  <TextInput
                    value={verificationCode}
                    onChangeText={(value) => setVerificationCode(value.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    placeholder="••••••"
                    placeholderTextColor="#9ca3af"
                    style={styles.input}
                    maxLength={6}
                    returnKeyType="done"
                    onSubmitEditing={primaryDisabled ? undefined : handleVerifyCode}
                  />
                </>
              )}

              {step === 'password' && (
                <>
                  <Text style={styles.label}>Password</Text>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    placeholder="Create a strong password"
                    placeholderTextColor="#9ca3af"
                    style={styles.input}
                    returnKeyType="next"
                  />

                  <Text style={styles.label}>Confirm password</Text>
                  <TextInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    placeholder="Repeat your password"
                    placeholderTextColor="#9ca3af"
                    style={styles.input}
                    returnKeyType="done"
                    onSubmitEditing={primaryDisabled ? undefined : handleSubmit}
                  />
                </>
              )}

              <TouchableOpacity
                style={[styles.primaryButton, primaryDisabled && styles.disabled]}
                onPress={handlePrimaryAction}
                disabled={primaryDisabled}
                activeOpacity={0.9}
              >
                <Text style={styles.primaryText}>
                  {step === 'contact'
                    ? busy
                      ? 'Sending…'
                      : 'Send verification code'
                    : step === 'verify'
                    ? busy
                      ? 'Verifying…'
                      : 'Verify code'
                    : busy
                    ? 'Creating account…'
                    : 'Create account'}
                </Text>
              </TouchableOpacity>

              <Divider />

              <TouchableOpacity style={styles.ghostButton} onPress={() => navigation.navigate('Login')} disabled={busy}>
                <Text style={styles.ghostButtonText}>I already have an account</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.legal}>
            By continuing, you agree to Ethos’s Terms of Service and acknowledge our Privacy Policy.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const RADIUS = 12;

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 48, paddingBottom: 32 },
  header: { marginBottom: 24 },
  brand: {
    fontSize: 42,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.5,
  },
  tagline: { marginTop: 6, fontSize: 16, color: '#475569' },
  card: {
    backgroundColor: '#fff',
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
    gap: 12,
  },
  listButton: {
    height: 52,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fafafa',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    justifyContent: 'space-between',
  },
  listButtonText: {
    flex: 1,
    color: '#111827',
    fontSize: 15,
    fontWeight: '600',
  },
  formHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  formTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#dbeafe',
    borderColor: '#2563eb',
  },
  tabLabel: {
    fontWeight: '600',
    color: '#6b7280',
  },
  tabLabelActive: {
    color: '#1d4ed8',
  },
  label: { marginTop: 10, marginBottom: 6, color: '#374151', fontWeight: '600' },
  input: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: RADIUS,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#0f172a',
  },
  primaryButton: {
    height: 52,
    borderRadius: RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    marginTop: 12,
  },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  disabled: { opacity: 0.6 },
  infoText: {
    backgroundColor: '#eff6ff',
    borderRadius: RADIUS,
    padding: 12,
    color: '#1d4ed8',
    lineHeight: 20,
  },
  ghostButton: {
    height: 48,
    borderRadius: RADIUS,
    borderWidth: 1,
    borderColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostButtonText: { color: '#2563eb', fontWeight: '700' },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 2,
  },
  hr: { flex: 1, height: 1, backgroundColor: '#e5e7eb' },
  hrLabel: {
    color: '#9ca3af',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 11,
  },
  legal: {
    textAlign: 'center',
    color: '#9ca3af',
    marginTop: 14,
    lineHeight: 18,
  },
});

export default RegisterScreen;
