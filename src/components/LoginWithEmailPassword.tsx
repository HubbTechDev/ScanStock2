import React, { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { authClient } from "@/lib/authClient";
import { useSession } from "@/lib/useSession";

export default function LoginWithEmailPassword() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { data: session } = useSession();

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter email and password");
      return;
    }

    setIsLoading(true);
    try {
      const result = await authClient.signIn.email({
        email,
        password,
      });

      if (result.error) {
        Alert.alert("Sign In Failed", result.error.message || "Please check your credentials");
      } else {
        Alert.alert("Success", "Signed in successfully!");
        setEmail("");
        setPassword("");
      }
    } catch (error) {
      Alert.alert("Error", "An unexpected error occurred");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!email || !password || !name) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    setIsLoading(true);
    try {
      const result = await authClient.signUp.email({
        email,
        password,
        name,
      });

      if (result.error) {
        Alert.alert("Sign Up Failed", result.error.message || "Please try again");
      } else {
        Alert.alert("Success", "Account created successfully!");
        setEmail("");
        setPassword("");
        setName("");
        setIsSignUp(false);
      }
    } catch (error) {
      Alert.alert("Error", "An unexpected error occurred");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await authClient.signOut();
      Alert.alert("Success", "Signed out successfully!");
    } catch (error) {
      Alert.alert("Error", "Failed to sign out");
      console.error(error);
    }
  };

  // If user is already logged in, show sign out button
  if (session) {
    return (
      <KeyboardAwareScrollView className="bg-white dark:bg-black">
        <View className="w-full p-6 gap-4">
          <View className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg border border-green-200 dark:border-green-700">
            <Text className="text-lg font-semibold mb-1 text-black dark:text-white">Signed in as:</Text>
            <Text className="text-base text-black dark:text-white">{session.user.name}</Text>
            <Text className="text-sm text-gray-600 dark:text-gray-400">{session.user.email}</Text>
          </View>
          <Pressable onPress={handleSignOut} className="bg-red-500 dark:bg-red-600 p-4 rounded-lg items-center">
            <Text className="text-white font-semibold text-base">Sign Out</Text>
          </Pressable>
        </View>
      </KeyboardAwareScrollView>
    );
  }

  return (
    <KeyboardAwareScrollView className="bg-white dark:bg-black">
      <View className="w-full p-6 gap-4">
        <Text className="text-2xl font-bold text-center mb-2 text-black dark:text-white">
          {isSignUp ? "Create Account" : "Sign In"}
        </Text>

        {isSignUp && (
          <View>
            <Text className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              placeholderTextColor="#9CA3AF"
              className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-white dark:bg-gray-800 text-black dark:text-white"
              autoCapitalize="words"
              editable={!isLoading}
            />
          </View>
        )}

        <View>
          <Text className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Enter your email"
            placeholderTextColor="#9CA3AF"
            keyboardType="email-address"
            autoCapitalize="none"
            className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-white dark:bg-gray-800 text-black dark:text-white"
            editable={!isLoading}
          />
        </View>

        <View>
          <Text className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
            placeholderTextColor="#9CA3AF"
            secureTextEntry
            className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-white dark:bg-gray-800 text-black dark:text-white"
            editable={!isLoading}
          />
        </View>

        <Pressable
          onPress={isSignUp ? handleSignUp : handleSignIn}
          disabled={isLoading}
          className={`p-4 rounded-lg items-center ${isLoading ? "bg-blue-300 dark:bg-blue-700" : "bg-blue-500 dark:bg-blue-600"}`}
        >
          <Text className="text-white font-semibold text-base">
            {isLoading ? "Loading..." : isSignUp ? "Sign Up" : "Sign In"}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setIsSignUp(!isSignUp)}
          disabled={isLoading}
          className="items-center"
        >
          <Text className="text-blue-500 dark:text-blue-400 text-sm">
            {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
          </Text>
        </Pressable>
      </View>
    </KeyboardAwareScrollView>
  );
}
