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
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);

  const disabled = useMemo(() => {
    if (busy) return true;
    if (!displayName.trim() || !email.trim() || !password || !confirmPassword) {
      return true;
    }
    if (password !== confirmPassword) {
      return true;
    }
    if (password.length < 8) {
      return true;
    }
    return false;
  }, [busy, displayName, email, password, confirmPassword]);

  const handleSocial = (provider: Social) => {
    Alert.alert(`Continue with ${provider}`, 'Single sign-on is coming soon.');
  };

  const handleSubmit = () => {
    setBusy(true);
    Alert.alert('Create an account', 'Registration is not yet available in this preview build.', [
      {
        text: 'OK',
        onPress: () => setBusy(false),
      },
    ]);
  };

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
                <TouchableOpacity onPress={() => setShowForm(false)} hitSlop={8}>
                  <Ionicons name="chevron-back" size={22} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.formTitle}>Use phone or email</Text>
                <View style={{ width: 22 }} />
              </View>

              <Text style={styles.label}>Display name</Text>
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Adventurer"
                placeholderTextColor="#9ca3af"
                style={styles.input}
                returnKeyType="next"
              />

              <Text style={styles.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="you@example.com"
                placeholderTextColor="#9ca3af"
                style={styles.input}
                returnKeyType="next"
              />

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
                onSubmitEditing={disabled ? undefined : handleSubmit}
              />

              <TouchableOpacity
                style={[styles.primaryButton, disabled && styles.disabled]}
                onPress={handleSubmit}
                disabled={disabled}
                activeOpacity={0.9}
              >
                <Text style={styles.primaryText}>{busy ? 'Creating account…' : 'Create account'}</Text>
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
