import React, { useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BlurView } from "expo-blur";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import {
  X,
  User,
  Building2,
  Copy,
  Check,
  Users,
  Settings,
  Warehouse,
  LogOut,
  ChevronRight,
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

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const DRAWER_WIDTH = SCREEN_WIDTH * 0.85;

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

type SidebarMenuProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function SidebarMenu({ isOpen, onClose }: SidebarMenuProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [copied, setCopied] = React.useState(false);
  const [isSigningOut, setIsSigningOut] = React.useState(false);

  const industry = useIndustryStore((s) => s.industry);
  const resetOnboarding = useIndustryStore((s) => s.resetOnboarding);
  const config = industry ? INDUSTRY_CONFIGS[industry] : null;
  const IndustryIcon = industry ? INDUSTRY_ICONS[industry] : Building2;

  const translateX = useSharedValue(-DRAWER_WIDTH);
  const backdropOpacity = useSharedValue(0);

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

  useEffect(() => {
    if (isOpen) {
      translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
      backdropOpacity.value = withTiming(1, { duration: 200 });
    } else {
      translateX.value = withSpring(-DRAWER_WIDTH, { damping: 20, stiffness: 200 });
      backdropOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [isOpen]);

  const drawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
    pointerEvents: backdropOpacity.value > 0 ? "auto" : "none",
  }));

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      const newX = Math.min(0, Math.max(-DRAWER_WIDTH, event.translationX));
      translateX.value = newX;
      backdropOpacity.value = interpolate(newX, [-DRAWER_WIDTH, 0], [0, 1]);
    })
    .onEnd((event) => {
      if (event.translationX < -50 || event.velocityX < -500) {
        translateX.value = withSpring(-DRAWER_WIDTH, { damping: 20 });
        backdropOpacity.value = withTiming(0, { duration: 200 });
        runOnJS(onClose)();
      } else {
        translateX.value = withSpring(0, { damping: 20 });
        backdropOpacity.value = withTiming(1, { duration: 200 });
      }
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
      onClose();
      router.replace("/auth");
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleNavigation = (route: string) => {
    onClose();
    setTimeout(() => {
      router.push(route as any);
    }, 100);
  };

  const handleChangeIndustry = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
    resetOnboarding();
    router.replace("/industry-selector");
  };

  const user = sessionData?.user;
  const org = orgData?.organization;

  if (!isOpen && translateX.value <= -DRAWER_WIDTH + 1) {
    return null;
  }

  return (
    <View className="absolute inset-0 z-50" pointerEvents={isOpen ? "auto" : "none"}>
      {/* Backdrop */}
      <Animated.View style={[{ position: "absolute", inset: 0 }, backdropStyle]}>
        <Pressable className="flex-1 bg-black/60" onPress={onClose} />
      </Animated.View>

      {/* Drawer */}
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            {
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: DRAWER_WIDTH,
              backgroundColor: "#0a0a0a",
              borderRightWidth: 1,
              borderRightColor: "rgba(255,255,255,0.1)",
            },
            drawerStyle,
          ]}
        >
          <View className="flex-1 pt-16 pb-10">
            {/* Close Button */}
            <Pressable
              onPress={onClose}
              className="absolute top-14 right-4 w-10 h-10 rounded-full bg-white/10 items-center justify-center"
            >
              <X size={20} color="#94A3B8" />
            </Pressable>

            {/* User Profile */}
            <View className="px-6 pb-6 border-b border-white/10">
              <View className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-violet-500 items-center justify-center mb-4 overflow-hidden">
                <View className="w-full h-full bg-cyan-500/30 items-center justify-center">
                  <User size={32} color="#06B6D4" />
                </View>
              </View>
              <Text className="text-white text-xl font-bold">
                {user?.name || "User"}
              </Text>
              <Text className="text-slate-400 text-sm mt-0.5">{user?.email}</Text>
            </View>

            {/* Organization Info */}
            {isLoadingOrg ? (
              <View className="px-6 py-6">
                <ActivityIndicator size="small" color="#06B6D4" />
              </View>
            ) : org ? (
              <View className="px-6 py-5 border-b border-white/10">
                <View className="flex-row items-center mb-4">
                  <View className="w-10 h-10 rounded-xl bg-emerald-500/20 items-center justify-center">
                    <Building2 size={20} color="#10B981" />
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="text-white font-semibold">{org.name}</Text>
                    <Text className="text-slate-400 text-xs capitalize">
                      {org.role} · {org.members?.length || 1} member{(org.members?.length || 1) !== 1 ? "s" : ""}
                    </Text>
                  </View>
                </View>

                {/* Invite Code */}
                <Pressable
                  onPress={handleCopyInviteCode}
                  className="flex-row items-center bg-white/5 rounded-xl p-3 active:bg-white/10"
                >
                  <View className="w-8 h-8 rounded-lg bg-violet-500/20 items-center justify-center">
                    {copied ? (
                      <Check size={16} color="#8B5CF6" />
                    ) : (
                      <Copy size={16} color="#8B5CF6" />
                    )}
                  </View>
                  <View className="flex-1 ml-3">
                    <Text className="text-slate-400 text-xs">Invite Code</Text>
                    <Text className="text-white font-mono tracking-widest">
                      {org.inviteCode}
                    </Text>
                  </View>
                  <Text className="text-slate-500 text-xs">
                    {copied ? "Copied!" : "Tap to copy"}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {/* Menu Items */}
            <View className="flex-1 px-4 py-4">
              <Text className="text-slate-500 text-xs font-semibold uppercase tracking-wider px-2 mb-3">
                Settings
              </Text>

              {/* Industry Type */}
              <Pressable
                onPress={handleChangeIndustry}
                className="flex-row items-center px-3 py-3.5 rounded-xl active:bg-white/5 mb-1"
              >
                <View
                  className="w-9 h-9 rounded-xl items-center justify-center"
                  style={{ backgroundColor: config ? `${config.color}20` : '#06B6D420' }}
                >
                  <IndustryIcon size={18} color={config?.color ?? '#06B6D4'} />
                </View>
                <View className="flex-1 ml-3">
                  <Text className="text-slate-400 text-xs">Industry Type</Text>
                  <Text className="text-white font-medium">
                    {config?.name ?? 'Not Selected'}
                  </Text>
                </View>
                <ChevronRight size={18} color="#64748B" />
              </Pressable>

              <Pressable
                onPress={() => handleNavigation("/storage-settings")}
                className="flex-row items-center px-3 py-3.5 rounded-xl active:bg-white/5"
              >
                <View className="w-9 h-9 rounded-xl bg-amber-500/20 items-center justify-center">
                  <Warehouse size={18} color="#F59E0B" />
                </View>
                <Text className="flex-1 text-white font-medium ml-3">
                  Storage Locations
                </Text>
                <ChevronRight size={18} color="#64748B" />
              </Pressable>
            </View>

            {/* Sign Out */}
            <View className="px-6">
              <Pressable
                onPress={handleSignOut}
                disabled={isSigningOut}
                className="flex-row items-center justify-center py-4 rounded-2xl bg-red-500/10 border border-red-500/20 active:bg-red-500/20"
              >
                {isSigningOut ? (
                  <ActivityIndicator size="small" color="#EF4444" />
                ) : (
                  <>
                    <LogOut size={18} color="#EF4444" />
                    <Text className="text-red-400 font-semibold ml-2">Sign Out</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
