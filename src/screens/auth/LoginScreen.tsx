import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { signIn, signUp } from '../../services/authService';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      await signIn(email, password);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  const handleSignUp = async () => {
    setLoading(true);
    setError('');
    try {
      await signUp(email, password);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <View className="flex-1 bg-black items-center justify-center px-8">
      <View className="items-center mb-12">
        <Text className="text-white text-5xl font-bold tracking-widest">NoMoS</Text>
        <Text className="text-green-400 text-2xl font-semibold tracking-wider">FIT</Text>
        <Text className="text-gray-500 text-sm mt-2 tracking-widest uppercase">
          Structure. Discipline. Progress.
        </Text>
      </View>

      <TextInput
        className="w-full bg-gray-900 text-white rounded-xl px-4 py-4 mb-3"
        placeholder="Email"
        placeholderTextColor="#6b7280"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TextInput
        className="w-full bg-gray-900 text-white rounded-xl px-4 py-4 mb-4"
        placeholder="Password"
        placeholderTextColor="#6b7280"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      {error ? <Text className="text-red-400 text-sm mb-3">{error}</Text> : null}

      {loading ? (
        <ActivityIndicator size="large" color="#4ade80" />
      ) : (
        <>
          <TouchableOpacity
            onPress={handleSignIn}
            className="w-full bg-green-500 rounded-xl py-4 items-center mb-3"
          >
            <Text className="text-black font-bold text-base">Sign In</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSignUp}
            className="w-full bg-gray-800 rounded-xl py-4 items-center"
          >
            <Text className="text-white font-semibold text-base">Create Account</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}