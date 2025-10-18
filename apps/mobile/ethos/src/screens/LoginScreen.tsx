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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';

const LoginScreen: React.FC = () => {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const handleLogin = async () => {
    setBusy(true);
    try {
      await signIn(email.trim(), password);
    } catch (error) {
      console.error('Failed to sign in', error);
      Alert.alert('Unable to sign in', 'Check your credentials and try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = () => {
    Alert.alert('Create an account', 'Registration is not yet available in this preview build.');
  };

  const handleSocialSignIn = (provider: string) => {
    Alert.alert('Sign in with ' + provider, 'Single sign-on is coming soon.');
  };

  const disabled = busy || !email.trim() || !password;

  return (
    <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.inner}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Ethos</Text>
          <Text style={styles.subtitle}>Guild quests on the go.</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@example.com"
            placeholderTextColor="#94a3b8"
            style={styles.input}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor="#94a3b8"
            style={styles.input}
          />

          <TouchableOpacity
            style={[styles.primaryButton, disabled && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={disabled}
          >
            <Text style={styles.primaryButtonText}>{busy ? 'Signing in…' : 'Sign in'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionsCard}>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleRegister} disabled={busy}>
            <Text style={styles.secondaryButtonText}>Register as a new user</Text>
          </TouchableOpacity>

          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerLabel}>Or continue with</Text>
            <View style={styles.divider} />
          </View>

          <View style={styles.socialGrid}>
            <TouchableOpacity
              style={styles.socialButton}
              onPress={() => handleSocialSignIn('Google')}
              disabled={busy}
            >
              <Text style={styles.socialButtonText}>Google</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.socialButton}
              onPress={() => handleSocialSignIn('Apple')}
              disabled={busy}
            >
              <Text style={styles.socialButtonText}>Apple</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.socialButton}
              onPress={() => handleSocialSignIn('GitHub')}
              disabled={busy}
            >
              <Text style={styles.socialButtonText}>GitHub</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.socialButton}
              onPress={() => handleSocialSignIn('Facebook / Instagram')}
              disabled={busy}
            >
              <Text style={styles.socialButtonText}>Facebook / Instagram</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 48,
    justifyContent: 'space-between',
  },
  header: {
    marginTop: 32,
  },
  title: {
    fontSize: 40,
    fontWeight: '700',
    color: '#f8fafc',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 16,
    color: '#cbd5f5',
    marginTop: 8,
  },
  form: {
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    borderRadius: 16,
    padding: 24,
    gap: 12,
  },
  label: {
    color: '#e2e8f0',
    fontWeight: '600',
    fontSize: 14,
  },
  input: {
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
    color: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  primaryButton: {
    backgroundColor: '#38bdf8',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 16,
  },
  actionsCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  secondaryButton: {
    borderColor: '#38bdf8',
    borderWidth: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#38bdf8',
    fontWeight: '600',
    fontSize: 15,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.3)',
  },
  dividerLabel: {
    color: '#94a3b8',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  socialGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  socialButton: {
    flexBasis: '48%',
    borderColor: 'rgba(148, 163, 184, 0.5)',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  socialButtonText: {
    color: '#e2e8f0',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default LoginScreen;
