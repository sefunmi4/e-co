import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSession } from '@/hooks/useSession';
import type { AuthStackParamList } from '@/navigation/types';

export type LoginScreenProps = NativeStackScreenProps<AuthStackParamList, 'Login'>;

const accentColor = '#1f9a6d';
const textColor = '#f5f5f5';

const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const { signIn, loading } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async () => {
    if (!email || !password) {
      Alert.alert('Missing information', 'Enter both email and password to continue.');
      return;
    }

    try {
      await signIn(email, password);
    } catch (error) {
      Alert.alert('Unable to sign in', error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', android: undefined })}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Sign in</Text>
          <Text style={styles.subtitle}>Use your Ethos credentials to resume your rituals.</Text>
        </View>
        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="username"
              placeholder="you@example.com"
              placeholderTextColor="rgba(245,245,245,0.6)"
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="password"
              placeholder="Your password"
              placeholderTextColor="rgba(245,245,245,0.6)"
              style={styles.input}
            />
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.submitButton, (pressed || loading) && styles.pressed]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#0c0c0c" /> : <Text style={styles.submitLabel}>Sign in</Text>}
        </Pressable>
      </KeyboardAvoidingView>

      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [styles.footerButton, pressed && styles.pressed]}
        onPress={() => navigation.navigate('Register')}
      >
        <Text style={styles.footerText}>Need an account? Create one</Text>
      </Pressable>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0c0c',
    paddingHorizontal: 24,
    paddingBottom: 24,
    justifyContent: 'space-between',
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    color: textColor,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: 'rgba(245,245,245,0.7)',
  },
  form: {
    gap: 24,
  },
  field: {
    gap: 8,
  },
  label: {
    color: textColor,
    fontWeight: '600',
  },
  input: {
    backgroundColor: 'rgba(245,245,245,0.08)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    color: textColor,
  },
  submitButton: {
    marginTop: 36,
    backgroundColor: accentColor,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitLabel: {
    color: '#0c0c0c',
    fontWeight: '600',
    fontSize: 18,
  },
  footerButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  footerText: {
    color: accentColor,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.75,
  },
});

export default LoginScreen;
