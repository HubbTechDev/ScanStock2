import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useQueryClient } from "@tanstack/react-query";
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, Sparkles } from "lucide-react-native";
import { authClient } from "@/lib/authClient";

type AuthMode = "login" | "signup";

export default function AuthScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buttonScale = useSharedValue(1);

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const handlePressIn = () => {
    buttonScale.value = withSpring(0.96, { damping: 15 });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePressOut = () => {
    buttonScale.value = withSpring(1, { damping: 15 });
  };

  const toggleMode = () => {
    setMode(mode === "login" ? "signup" : "login");
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleAuth = async () => {
    Keyboard.dismiss();
    setError(null);
    setIsLoading(true);

    try {
      if (mode === "signup") {
        const result = await authClient.signUp.email({
          email,
          password,
          name: name || email.split("@")[0],
        });
        if (result.error) {
          setError(result.error.message ?? "Sign up failed");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          return;
        }
      } else {
        const result = await authClient.signIn.email({
          email,
          password,
        });
        if (result.error) {
          setError(result.error.message ?? "Login failed");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          return;
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Invalidate session query so AuthGuard picks up new state
      await queryClient.invalidateQueries({ queryKey: ['session'] });
      router.replace("/organization-setup");
    } catch (err) {
      setError("Something went wrong. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  const isValid = email.includes("@") && password.length >= 6 && (mode === "login" || name.length > 0);

  return (
    <View className="flex-1 bg-black">
      {/* Gradient Background */}
      <LinearGradient
        colors={["#0a0a0a", "#1a1a2e", "#16213e", "#0f0f23"]}
        locations={[0, 0.3, 0.7, 1]}
        style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
      />

      {/* Decorative Elements */}
      <View className="absolute top-20 -left-20 w-60 h-60 rounded-full bg-cyan-500/10 blur-3xl" />
      <View className="absolute bottom-40 -right-20 w-72 h-72 rounded-full bg-violet-500/10 blur-3xl" />

      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          <View className="flex-1 px-6 justify-center">
            {/* Header */}
            <Animated.View entering={FadeInDown.delay(100).springify()} className="items-center mb-10">
              <View className="w-20 h-20 rounded-3xl bg-gradient-to-br from-cyan-500 to-violet-500 items-center justify-center mb-6 overflow-hidden">
                <LinearGradient
                  colors={["#06B6D4", "#8B5CF6"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
                />
                <Sparkles size={36} color="#FFFFFF" />
              </View>
              <Text className="text-white text-3xl font-bold tracking-tight">
                {mode === "login" ? "Welcome Back" : "Get Started"}
              </Text>
              <Text className="text-slate-400 text-base mt-2 text-center">
                {mode === "login"
                  ? "Sign in to access your inventory"
                  : "Create an account to start tracking"}
              </Text>
            </Animated.View>

            {/* Form Card */}
            <Animated.View entering={FadeInUp.delay(200).springify()}>
              <BlurView intensity={20} tint="dark" className="rounded-3xl overflow-hidden">
                <View className="p-6 bg-white/5 border border-white/10 rounded-3xl">
                  {/* Name Field (Signup only) */}
                  {mode === "signup" && (
                    <Animated.View entering={FadeIn.delay(100)} className="mb-4">
                      <Text className="text-slate-400 text-sm mb-2 ml-1">Full Name</Text>
                      <View className="flex-row items-center bg-white/5 rounded-2xl border border-white/10 px-4">
                        <User size={20} color="#64748B" />
                        <TextInput
                          className="flex-1 py-4 px-3 text-white text-base"
                          placeholder="John Doe"
                          placeholderTextColor="#475569"
                          value={name}
                          onChangeText={setName}
                          autoCapitalize="words"
                        />
                      </View>
                    </Animated.View>
                  )}

                  {/* Email Field */}
                  <View className="mb-4">
                    <Text className="text-slate-400 text-sm mb-2 ml-1">Email</Text>
                    <View className="flex-row items-center bg-white/5 rounded-2xl border border-white/10 px-4">
                      <Mail size={20} color="#64748B" />
                      <TextInput
                        className="flex-1 py-4 px-3 text-white text-base"
                        placeholder="you@example.com"
                        placeholderTextColor="#475569"
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        autoComplete="email"
                      />
                    </View>
                  </View>

                  {/* Password Field */}
                  <View className="mb-6">
                    <Text className="text-slate-400 text-sm mb-2 ml-1">Password</Text>
                    <View className="flex-row items-center bg-white/5 rounded-2xl border border-white/10 px-4">
                      <Lock size={20} color="#64748B" />
                      <TextInput
                        className="flex-1 py-4 px-3 text-white text-base"
                        placeholder="••••••••"
                        placeholderTextColor="#475569"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                        autoComplete="password"
                      />
                      <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
                        {showPassword ? (
                          <EyeOff size={20} color="#64748B" />
                        ) : (
                          <Eye size={20} color="#64748B" />
                        )}
                      </Pressable>
                    </View>
                    {mode === "signup" && (
                      <Text className="text-slate-500 text-xs mt-2 ml-1">
                        At least 6 characters
                      </Text>
                    )}
                  </View>

                  {/* Error Message */}
                  {error && (
                    <Animated.View entering={FadeIn} className="mb-4 bg-red-500/10 rounded-xl p-3 border border-red-500/20">
                      <Text className="text-red-400 text-sm text-center">{error}</Text>
                    </Animated.View>
                  )}

                  {/* Submit Button */}
                  <Animated.View style={buttonAnimatedStyle}>
                    <Pressable
                      onPressIn={handlePressIn}
                      onPressOut={handlePressOut}
                      onPress={handleAuth}
                      disabled={!isValid || isLoading}
                      className="overflow-hidden rounded-2xl"
                    >
                      <LinearGradient
                        colors={isValid ? ["#06B6D4", "#8B5CF6"] : ["#374151", "#374151"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{ paddingVertical: 16, paddingHorizontal: 24 }}
                      >
                        <View className="flex-row items-center justify-center">
                          {isLoading ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <>
                              <Text
                                className={`text-base font-bold mr-2 ${
                                  isValid ? "text-white" : "text-slate-500"
                                }`}
                              >
                                {mode === "login" ? "Sign In" : "Create Account"}
                              </Text>
                              <ArrowRight size={20} color={isValid ? "#FFFFFF" : "#64748B"} />
                            </>
                          )}
                        </View>
                      </LinearGradient>
                    </Pressable>
                  </Animated.View>
                </View>
              </BlurView>
            </Animated.View>

            {/* Toggle Mode */}
            <Animated.View entering={FadeInUp.delay(300).springify()} className="mt-8 items-center">
              <Pressable onPress={toggleMode} className="flex-row items-center py-3">
                <Text className="text-slate-400">
                  {mode === "login" ? "Don't have an account?" : "Already have an account?"}
                </Text>
                <Text className="text-cyan-400 font-semibold ml-2">
                  {mode === "login" ? "Sign Up" : "Sign In"}
                </Text>
              </Pressable>
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
