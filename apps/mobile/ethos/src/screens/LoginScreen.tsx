import React, { useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons'; // Expo includes @expo/vector-icons
import { useAuth } from '../context/AuthContext';

const Divider = () => (
  <View style={styles.dividerRow}>
    <View style={styles.hr} />
    <Text style={styles.hrLabel}>or</Text>
    <View style={styles.hr} />
  </View>
);

type Social =
  | 'Apple'
  | 'Google'
  | 'GitHub'
  | 'Instagram'
  | 'Twitter'
  | 'Facebook';

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
  <TouchableOpacity
    style={styles.listButton}
    activeOpacity={0.8}
    onPress={onPress}
    disabled={disabled}
  >
    {label === 'Use phone or email' ? (
      <Ionicons name="person-outline" size={20} color="#111827" />
    ) : (
      <Ionicons name={ICON[label as Social]} size={20} color="#111827" />
    )}
    <Text style={styles.listButtonText}>
      {label === 'Use phone or email' ? 'Use phone or email' : `Continue with ${label}`}
    </Text>
    <Ionicons name="chevron-forward" size={18} color="#6b7280" />
  </TouchableOpacity>
);

const LoginScreen: React.FC = () => {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const disabled = busy || !email.trim() || !password;

  const handleLogin = async () => {
    setBusy(true);
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      console.error(e);
      Alert.alert('Unable to sign in', 'Check your credentials and try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = () => {
    Alert.alert('Create an account', 'Registration is not yet available in this preview build.');
  };

  const handleSSO = (provider: Social) => {
    Alert.alert(`Sign in with ${provider}`, 'Single sign-on is coming soon.');
  };

  return (
    <LinearGradient colors={['#ffffff', '#f3f4f6']} style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.brand}>Ethos</Text>
            <Text style={styles.tagline}>Guild quests on the go.</Text>
          </View>

          {/* Big stacked action list – TikTok-style */}
          {!showForm && (
            <View style={styles.card}>
              <SocialButton
                label="Use phone or email"
                onPress={() => setShowForm(true)}
                disabled={busy}
              />
              <SocialButton label="Apple" onPress={() => handleSSO('Apple')} disabled={busy} />
              <SocialButton label="Google" onPress={() => handleSSO('Google')} disabled={busy} />
              <SocialButton label="GitHub" onPress={() => handleSSO('GitHub')} disabled={busy} />
              <SocialButton label="Instagram" onPress={() => handleSSO('Instagram')} disabled={busy} />
              <SocialButton label="Facebook" onPress={() => handleSSO('Facebook')} disabled={busy} />
              <Divider />
              <TouchableOpacity style={styles.ghostButton} onPress={handleRegister} disabled={busy}>
                <Text style={styles.ghostButtonText}>Register as a new user</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Inline email/password panel that slides in when chosen */}
          {showForm && (
            <View style={styles.card}>
              <View style={styles.formHeaderRow}>
                <TouchableOpacity onPress={() => setShowForm(false)} hitSlop={8}>
                  <Ionicons name="chevron-back" size={22} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.formTitle}>Use phone or email</Text>
                <View style={{ width: 22 }} />
              </View>

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
                placeholder="••••••••"
                placeholderTextColor="#9ca3af"
                style={styles.input}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />

              <TouchableOpacity
                style={[styles.primaryButton, disabled && styles.disabled]}
                onPress={handleLogin}
                disabled={disabled}
                activeOpacity={0.9}
              >
                <Text style={styles.primaryText}>{busy ? 'Signing in…' : 'Sign in'}</Text>
              </TouchableOpacity>

              <Divider />

              <TouchableOpacity style={styles.ghostButton} onPress={handleRegister} disabled={busy}>
                <Text style={styles.ghostButtonText}>Register as a new user</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Legal */}
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

  // TikTok-like tall list buttons
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

  // Inline form
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

export default LoginScreen;