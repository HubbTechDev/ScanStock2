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
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Users,
  Plus,
  ArrowRight,
  Copy,
  Check,
  LogOut,
} from "lucide-react-native";
import * as Clipboard from "expo-clipboard";
import { api } from "@/lib/api";
import { authClient } from "@/lib/authClient";

type SetupMode = "choose" | "create" | "join";

type OrganizationMember = {
  id: string;
  userId: string;
  name: string | null;
  email: string;
  role: string;
  joinedAt: string;
};

type Organization = {
  id: string;
  name: string;
  inviteCode: string;
  role: string;
  members: OrganizationMember[];
  createdAt: string;
};

type OrganizationResponse = {
  organization: Organization | null;
};

export default function OrganizationSetupScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<SetupMode>("choose");
  const [orgName, setOrgName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [copied, setCopied] = useState(false);
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

  // Check if user already has an organization
  const { data: orgData, isLoading: isLoadingOrg } = useQuery({
    queryKey: ["organization"],
    queryFn: () => api.get<OrganizationResponse>("/api/organization"),
  });

  // Redirect if user already has an organization
  useEffect(() => {
    if (orgData?.organization) {
      router.replace("/(tabs)");
    }
  }, [orgData]);

  const createOrgMutation = useMutation({
    mutationFn: (name: string) =>
      api.post<OrganizationResponse>("/api/organization", { name }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["organization"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      router.replace("/(tabs)");
    },
    onError: (err: Error) => {
      setError(err.message || "Failed to create organization");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const joinOrgMutation = useMutation({
    mutationFn: (code: string) =>
      api.post<OrganizationResponse>("/api/organization/join", { inviteCode: code.toUpperCase() }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["organization"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      router.replace("/(tabs)");
    },
    onError: (err: Error) => {
      setError(err.message || "Invalid invite code");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const handleCreate = () => {
    Keyboard.dismiss();
    setError(null);
    if (orgName.trim().length < 2) {
      setError("Organization name must be at least 2 characters");
      return;
    }
    createOrgMutation.mutate(orgName.trim());
  };

  const handleJoin = () => {
    Keyboard.dismiss();
    setError(null);
    if (inviteCode.trim().length !== 6) {
      setError("Invite code must be 6 characters");
      return;
    }
    joinOrgMutation.mutate(inviteCode.trim());
  };

  const handleSignOut = async () => {
    await authClient.signOut();
    queryClient.invalidateQueries({ queryKey: ['session'] });
    router.replace("/auth");
  };

  if (isLoadingOrg) {
    return (
      <View className="flex-1 bg-black items-center justify-center">
        <ActivityIndicator size="large" color="#06B6D4" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      {/* Gradient Background */}
      <LinearGradient
        colors={["#0a0a0a", "#1a1a2e", "#16213e", "#0f0f23"]}
        locations={[0, 0.3, 0.7, 1]}
        style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
      />

      {/* Decorative Elements */}
      <View className="absolute top-32 -left-20 w-60 h-60 rounded-full bg-emerald-500/10 blur-3xl" />
      <View className="absolute bottom-60 -right-20 w-72 h-72 rounded-full bg-cyan-500/10 blur-3xl" />

      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1"
        >
          {/* Sign Out Button */}
          <View className="px-6 pt-4 flex-row justify-end">
            <Pressable
              onPress={handleSignOut}
              className="flex-row items-center px-4 py-2 rounded-full bg-white/5 border border-white/10"
            >
              <LogOut size={16} color="#94A3B8" />
              <Text className="text-slate-400 text-sm ml-2">Sign Out</Text>
            </Pressable>
          </View>

          <View className="flex-1 px-6 justify-center">
            {/* Choose Mode */}
            {mode === "choose" && (
              <>
                <Animated.View entering={FadeInDown.delay(100).springify()} className="items-center mb-10">
                  <View className="w-20 h-20 rounded-3xl items-center justify-center mb-6 overflow-hidden">
                    <LinearGradient
                      colors={["#10B981", "#06B6D4"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
                    />
                    <Building2 size={36} color="#FFFFFF" />
                  </View>
                  <Text className="text-white text-3xl font-bold tracking-tight text-center">
                    Set Up Your Team
                  </Text>
                  <Text className="text-slate-400 text-base mt-2 text-center px-4">
                    Create a new organization or join an existing one to share inventory
                  </Text>
                </Animated.View>

                <Animated.View entering={FadeInUp.delay(200).springify()} className="gap-4">
                  {/* Create Option */}
                  <Pressable
                    onPress={() => {
                      setMode("create");
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <BlurView intensity={20} tint="dark" className="rounded-2xl overflow-hidden">
                      <View className="p-5 bg-white/5 border border-white/10 rounded-2xl flex-row items-center">
                        <View className="w-14 h-14 rounded-2xl bg-emerald-500/20 items-center justify-center">
                          <Plus size={28} color="#10B981" />
                        </View>
                        <View className="flex-1 ml-4">
                          <Text className="text-white font-bold text-lg">Create Organization</Text>
                          <Text className="text-slate-400 text-sm mt-0.5">
                            Start fresh with a new team
                          </Text>
                        </View>
                        <ArrowRight size={20} color="#64748B" />
                      </View>
                    </BlurView>
                  </Pressable>

                  {/* Join Option */}
                  <Pressable
                    onPress={() => {
                      setMode("join");
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <BlurView intensity={20} tint="dark" className="rounded-2xl overflow-hidden">
                      <View className="p-5 bg-white/5 border border-white/10 rounded-2xl flex-row items-center">
                        <View className="w-14 h-14 rounded-2xl bg-cyan-500/20 items-center justify-center">
                          <Users size={28} color="#06B6D4" />
                        </View>
                        <View className="flex-1 ml-4">
                          <Text className="text-white font-bold text-lg">Join Organization</Text>
                          <Text className="text-slate-400 text-sm mt-0.5">
                            Enter an invite code to join
                          </Text>
                        </View>
                        <ArrowRight size={20} color="#64748B" />
                      </View>
                    </BlurView>
                  </Pressable>
                </Animated.View>
              </>
            )}

            {/* Create Mode */}
            {mode === "create" && (
              <>
                <Animated.View entering={FadeInDown.springify()} className="items-center mb-8">
                  <View className="w-16 h-16 rounded-2xl items-center justify-center mb-4 overflow-hidden">
                    <LinearGradient
                      colors={["#10B981", "#059669"]}
                      style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
                    />
                    <Plus size={32} color="#FFFFFF" />
                  </View>
                  <Text className="text-white text-2xl font-bold">Create Organization</Text>
                  <Text className="text-slate-400 text-sm mt-1 text-center">
                    Give your team a name
                  </Text>
                </Animated.View>

                <Animated.View entering={FadeInUp.delay(100).springify()}>
                  <BlurView intensity={20} tint="dark" className="rounded-3xl overflow-hidden">
                    <View className="p-6 bg-white/5 border border-white/10 rounded-3xl">
                      <Text className="text-slate-400 text-sm mb-2 ml-1">Organization Name</Text>
                      <View className="flex-row items-center bg-white/5 rounded-2xl border border-white/10 px-4 mb-6">
                        <Building2 size={20} color="#64748B" />
                        <TextInput
                          className="flex-1 py-4 px-3 text-white text-base"
                          placeholder="My Awesome Team"
                          placeholderTextColor="#475569"
                          value={orgName}
                          onChangeText={setOrgName}
                          autoFocus
                        />
                      </View>

                      {error && (
                        <Animated.View entering={FadeIn} className="mb-4 bg-red-500/10 rounded-xl p-3 border border-red-500/20">
                          <Text className="text-red-400 text-sm text-center">{error}</Text>
                        </Animated.View>
                      )}

                      <Animated.View style={buttonAnimatedStyle}>
                        <Pressable
                          onPressIn={handlePressIn}
                          onPressOut={handlePressOut}
                          onPress={handleCreate}
                          disabled={orgName.trim().length < 2 || createOrgMutation.isPending}
                          className="overflow-hidden rounded-2xl"
                        >
                          <LinearGradient
                            colors={orgName.trim().length >= 2 ? ["#10B981", "#059669"] : ["#374151", "#374151"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={{ paddingVertical: 16 }}
                          >
                            <View className="flex-row items-center justify-center">
                              {createOrgMutation.isPending ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                              ) : (
                                <>
                                  <Text className={`text-base font-bold mr-2 ${orgName.trim().length >= 2 ? "text-white" : "text-slate-500"}`}>
                                    Create & Continue
                                  </Text>
                                  <ArrowRight size={20} color={orgName.trim().length >= 2 ? "#FFFFFF" : "#64748B"} />
                                </>
                              )}
                            </View>
                          </LinearGradient>
                        </Pressable>
                      </Animated.View>
                    </View>
                  </BlurView>
                </Animated.View>

                <Pressable
                  onPress={() => {
                    setMode("choose");
                    setError(null);
                  }}
                  className="mt-6 items-center py-3"
                >
                  <Text className="text-slate-400">Go Back</Text>
                </Pressable>
              </>
            )}

            {/* Join Mode */}
            {mode === "join" && (
              <>
                <Animated.View entering={FadeInDown.springify()} className="items-center mb-8">
                  <View className="w-16 h-16 rounded-2xl items-center justify-center mb-4 overflow-hidden">
                    <LinearGradient
                      colors={["#06B6D4", "#0891B2"]}
                      style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
                    />
                    <Users size={32} color="#FFFFFF" />
                  </View>
                  <Text className="text-white text-2xl font-bold">Join Organization</Text>
                  <Text className="text-slate-400 text-sm mt-1 text-center">
                    Enter the 6-character invite code
                  </Text>
                </Animated.View>

                <Animated.View entering={FadeInUp.delay(100).springify()}>
                  <BlurView intensity={20} tint="dark" className="rounded-3xl overflow-hidden">
                    <View className="p-6 bg-white/5 border border-white/10 rounded-3xl">
                      <Text className="text-slate-400 text-sm mb-2 ml-1">Invite Code</Text>
                      <View className="flex-row items-center bg-white/5 rounded-2xl border border-white/10 px-4 mb-6">
                        <TextInput
                          className="flex-1 py-4 text-white text-2xl font-mono tracking-[0.5em] text-center"
                          placeholder="ABC123"
                          placeholderTextColor="#475569"
                          value={inviteCode}
                          onChangeText={(text) => setInviteCode(text.toUpperCase().slice(0, 6))}
                          autoCapitalize="characters"
                          autoFocus
                          maxLength={6}
                        />
                      </View>

                      {error && (
                        <Animated.View entering={FadeIn} className="mb-4 bg-red-500/10 rounded-xl p-3 border border-red-500/20">
                          <Text className="text-red-400 text-sm text-center">{error}</Text>
                        </Animated.View>
                      )}

                      <Animated.View style={buttonAnimatedStyle}>
                        <Pressable
                          onPressIn={handlePressIn}
                          onPressOut={handlePressOut}
                          onPress={handleJoin}
                          disabled={inviteCode.length !== 6 || joinOrgMutation.isPending}
                          className="overflow-hidden rounded-2xl"
                        >
                          <LinearGradient
                            colors={inviteCode.length === 6 ? ["#06B6D4", "#0891B2"] : ["#374151", "#374151"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={{ paddingVertical: 16 }}
                          >
                            <View className="flex-row items-center justify-center">
                              {joinOrgMutation.isPending ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                              ) : (
                                <>
                                  <Text className={`text-base font-bold mr-2 ${inviteCode.length === 6 ? "text-white" : "text-slate-500"}`}>
                                    Join Team
                                  </Text>
                                  <ArrowRight size={20} color={inviteCode.length === 6 ? "#FFFFFF" : "#64748B"} />
                                </>
                              )}
                            </View>
                          </LinearGradient>
                        </Pressable>
                      </Animated.View>
                    </View>
                  </BlurView>
                </Animated.View>

                <Pressable
                  onPress={() => {
                    setMode("choose");
                    setError(null);
                  }}
                  className="mt-6 items-center py-3"
                >
                  <Text className="text-slate-400">Go Back</Text>
                </Pressable>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
