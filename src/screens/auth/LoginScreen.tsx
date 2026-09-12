import React, { useState } from 'react';

import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  signIn,
  signUp,
} from '../../services/authService';

type Mode = 'login' | 'register';

export default function LoginScreen() {
  const [mode, setMode] = useState<Mode>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isLogin = mode === 'login';

  const readableError = (err: any) => {
    switch (err?.code) {
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';

      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Incorrect email or password.';

      case 'auth/email-already-in-use':
        return 'This email is already registered.';

      case 'auth/weak-password':
        return 'Password must be at least 6 characters.';

      case 'auth/network-request-failed':
        return 'Network error. Check your connection.';

      case 'auth/too-many-requests':
        return 'Too many attempts. Please try again later.';

      default:
        return err?.message || 'Something went wrong.';
    }
  };

  const handleSubmit = async () => {
    setError('');

    if (!email.trim()) {
      setError('Enter your email.');
      return;
    }

    if (!password) {
      setError('Enter your password.');
      return;
    }

    if (!isLogin && password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    try {
      setLoading(true);

      if (isLogin) {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }

      // No manual navigation needed.
      // AuthProvider updates the user automatically.
    } catch (err) {
      setError(readableError(err));
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setError('');
    setPassword('');

    setMode(isLogin ? 'register' : 'login');
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brand}>
          <Text style={styles.logo}>NoMoS</Text>
          <Text style={styles.logoAccent}>FIT</Text>

          <Text style={styles.tagline}>
            STRUCTURE. DISCIPLINE. PROGRESS.
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.title}>
            {isLogin ? 'Welcome back' : 'Create account'}
          </Text>

          <Text style={styles.subtitle}>
            {isLogin
              ? 'Sign in to continue your training.'
              : 'Create your NoMoSFit account.'}
          </Text>

          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor="#6B7280"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />

          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor="#6B7280"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />

          {error ? (
            <Text style={styles.error}>{error}</Text>
          ) : null}

          <TouchableOpacity
            style={[
              styles.primaryButton,
              loading && styles.disabledButton,
            ]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#050505" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {isLogin ? 'Sign In' : 'Create Account'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchButton}
            onPress={switchMode}
            disabled={loading}
          >
            <Text style={styles.switchText}>
              {isLogin
                ? "Don't have an account? "
                : 'Already have an account? '}

              <Text style={styles.switchAccent}>
                {isLogin ? 'Create one' : 'Sign in'}
              </Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#050505',
  },

  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },

  brand: {
    alignItems: 'center',
    marginBottom: 48,
  },

  logo: {
    color: '#F9FAFB',
    fontSize: 42,
    fontWeight: '900',
  },

  logoAccent: {
    color: '#4ADE80',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 3,
    marginTop: -2,
  },

  tagline: {
    color: '#52525B',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 14,
  },

  form: {
    width: '100%',
  },

  title: {
    color: '#F9FAFB',
    fontSize: 28,
    fontWeight: '800',
  },

  subtitle: {
    color: '#71717A',
    fontSize: 14,
    marginTop: 6,
    marginBottom: 26,
  },

  input: {
    backgroundColor: '#111827',
    borderColor: '#1F2937',
    borderWidth: 1,
    borderRadius: 16,
    color: '#F9FAFB',
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 12,
  },

  error: {
    color: '#F87171',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },

  primaryButton: {
    height: 54,
    backgroundColor: '#4ADE80',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },

  disabledButton: {
    opacity: 0.6,
  },

  primaryButtonText: {
    color: '#050505',
    fontSize: 16,
    fontWeight: '800',
  },

  switchButton: {
    paddingVertical: 22,
    alignItems: 'center',
  },

  switchText: {
    color: '#71717A',
    fontSize: 14,
  },

  switchAccent: {
    color: '#4ADE80',
    fontWeight: '700',
  },
});