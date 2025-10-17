import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';

const LoginScreen: React.FC = () => {
  const { signIn, signInAsGuest } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
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

  const handleGuestLogin = async () => {
    setBusy(true);
    try {
      await signInAsGuest(displayName.trim() || undefined);
    } catch (error) {
      console.error('Failed to continue as guest', error);
      Alert.alert('Unable to continue as guest', 'Try again in a few moments.');
    } finally {
      setBusy(false);
    }
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

        <View style={styles.guestCard}>
          <Text style={styles.guestTitle}>Explore as a guest</Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Display name (optional)"
            placeholderTextColor="#64748b"
            style={styles.guestInput}
          />
          <TouchableOpacity style={styles.secondaryButton} onPress={handleGuestLogin} disabled={busy}>
            <Text style={styles.secondaryButtonText}>{busy ? 'Connecting…' : 'Continue as guest'}</Text>
          </TouchableOpacity>
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
  guestCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  guestTitle: {
    color: '#e2e8f0',
    fontWeight: '600',
    fontSize: 16,
  },
  guestInput: {
    backgroundColor: 'rgba(148, 163, 184, 0.25)',
    color: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
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
});

export default LoginScreen;
