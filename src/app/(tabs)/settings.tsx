import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import {
  Settings,
  LogOut,
  Building2,
  Users,
  Copy,
  Check,
  ChevronRight,
  User,
  Mail,
  RefreshCw,
  Warehouse,
  ShoppingBag,
  UtensilsCrossed,
} from "lucide-react-native";
import { authClient } from "@/lib/authClient";
import { api } from "@/lib/api";
import { useIndustryStore, INDUSTRY_CONFIGS } from "@/lib/industry-store";

const INDUSTRY_ICONS = {
  retail: ShoppingBag,
  restaurant: UtensilsCrossed,
  hospitality: Building2,
} as const;

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

export default function SettingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const industry = useIndustryStore((s) => s.industry);
  const resetOnboarding = useIndustryStore((s) => s.resetOnboarding);
  const config = industry ? INDUSTRY_CONFIGS[industry] : null;
  const IndustryIcon = industry ? INDUSTRY_ICONS[industry] : Building2;

  const { data: sessionData } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const session = await authClient.getSession();
      return session.data;
    },
  });

  const { data: orgData, isLoading: isLoadingOrg } = useQuery({
    queryKey: ["organization"],
    queryFn: () => api.get<OrganizationResponse>("/api/organization"),
  });

  const handleCopyInviteCode = async () => {
    if (orgData?.organization?.inviteCode) {
      await Clipboard.setStringAsync(orgData.organization.inviteCode);
      setCopied(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await authClient.signOut();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.clear();
      router.replace("/auth");
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleChangeIndustry = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    resetOnboarding();
    router.replace("/industry-selector");
  };

  const user = sessionData?.user;
  const org = orgData?.organization;

  return (
    <View className="flex-1 bg-[#0a0a0a]">
      <SafeAreaView className="flex-1" edges={["top"]}>
        {/* Header */}
        <View className="px-5 pt-4 pb-6">
          <Text className="text-white text-3xl font-bold">Settings</Text>
        </View>

        <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
          {/* Account Section */}
          <View className="mb-6">
            <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3 ml-1">
              Account
            </Text>
            <View className="bg-[#1C1C1E] rounded-2xl overflow-hidden">
              <View className="p-4 flex-row items-center border-b border-white/5">
                <View className="w-12 h-12 rounded-full bg-cyan-500/20 items-center justify-center">
                  <User size={24} color="#06B6D4" />
                </View>
                <View className="flex-1 ml-3">
                  <Text className="text-white font-semibold text-base">
                    {user?.name || "User"}
                  </Text>
                  <Text className="text-slate-400 text-sm">{user?.email}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Organization Section */}
          <View className="mb-6">
            <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3 ml-1">
              Organization
            </Text>
            <View className="bg-[#1C1C1E] rounded-2xl overflow-hidden">
              {isLoadingOrg ? (
                <View className="p-6 items-center">
                  <ActivityIndicator size="small" color="#06B6D4" />
                </View>
              ) : org ? (
                <>
                  <View className="p-4 flex-row items-center border-b border-white/5">
                    <View className="w-12 h-12 rounded-full bg-emerald-500/20 items-center justify-center">
                      <Building2 size={24} color="#10B981" />
                    </View>
                    <View className="flex-1 ml-3">
                      <Text className="text-white font-semibold text-base">
                        {org.name}
                      </Text>
                      <Text className="text-slate-400 text-sm capitalize">
                        {org.role}
                      </Text>
                    </View>
                  </View>

                  {/* Invite Code */}
                  <Pressable
                    onPress={handleCopyInviteCode}
                    className="p-4 flex-row items-center border-b border-white/5 active:bg-white/5"
                  >
                    <View className="w-10 h-10 rounded-full bg-violet-500/20 items-center justify-center">
                      {copied ? (
                        <Check size={20} color="#8B5CF6" />
                      ) : (
                        <Copy size={20} color="#8B5CF6" />
                      )}
                    </View>
                    <View className="flex-1 ml-3">
                      <Text className="text-slate-400 text-xs mb-0.5">
                        Invite Code
                      </Text>
                      <Text className="text-white font-mono text-lg tracking-widest">
                        {org.inviteCode}
                      </Text>
                    </View>
                    <Text className="text-slate-500 text-xs">
                      {copied ? "Copied!" : "Tap to copy"}
                    </Text>
                  </Pressable>

                  {/* Members */}
                  <View className="p-4 flex-row items-center">
                    <View className="w-10 h-10 rounded-full bg-cyan-500/20 items-center justify-center">
                      <Users size={20} color="#06B6D4" />
                    </View>
                    <View className="flex-1 ml-3">
                      <Text className="text-slate-400 text-xs mb-0.5">
                        Team Members
                      </Text>
                      <Text className="text-white font-semibold">
                        {org.members?.length || 1} member
                        {(org.members?.length || 1) !== 1 ? "s" : ""}
                      </Text>
                    </View>
                  </View>
                </>
              ) : (
                <View className="p-4">
                  <Text className="text-slate-400 text-center">
                    No organization found
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* App Settings Section */}
          <View className="mb-6">
            <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3 ml-1">
              App Settings
            </Text>
            <View className="bg-[#1C1C1E] rounded-2xl overflow-hidden">
              {/* Industry Type */}
              <Pressable
                onPress={handleChangeIndustry}
                className="p-4 flex-row items-center border-b border-white/5 active:bg-white/5"
              >
                <View
                  className="w-10 h-10 rounded-full items-center justify-center"
                  style={{ backgroundColor: config ? `${config.color}20` : '#06B6D420' }}
                >
                  <IndustryIcon size={20} color={config?.color ?? '#06B6D4'} />
                </View>
                <View className="flex-1 ml-3">
                  <Text className="text-slate-400 text-xs mb-0.5">
                    Industry Type
                  </Text>
                  <Text className="text-white font-semibold">
                    {config?.name ?? 'Not Selected'}
                  </Text>
                </View>
                <ChevronRight size={20} color="#64748B" />
              </Pressable>

              <Pressable
                onPress={() => router.push("/storage-settings")}
                className="p-4 flex-row items-center active:bg-white/5"
              >
                <View className="w-10 h-10 rounded-full bg-amber-500/20 items-center justify-center">
                  <Warehouse size={20} color="#F59E0B" />
                </View>
                <Text className="flex-1 text-white font-medium ml-3">
                  Storage Locations
                </Text>
                <ChevronRight size={20} color="#64748B" />
              </Pressable>
            </View>
          </View>

          {/* Sign Out Section */}
          <View className="mb-10">
            <Pressable
              onPress={handleSignOut}
              disabled={isSigningOut}
              className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex-row items-center justify-center active:bg-red-500/20"
            >
              {isSigningOut ? (
                <ActivityIndicator size="small" color="#EF4444" />
              ) : (
                <>
                  <LogOut size={20} color="#EF4444" />
                  <Text className="text-red-400 font-semibold ml-2">
                    Sign Out
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
