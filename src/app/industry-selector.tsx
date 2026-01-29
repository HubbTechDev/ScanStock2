import React from 'react';
import { View, Text, Pressable, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ShoppingBag, UtensilsCrossed, Building2, Sparkles, ChevronRight } from 'lucide-react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useIndustryStore, INDUSTRY_CONFIGS, type IndustryType } from '@/lib/industry-store';

const { width } = Dimensions.get('window');

const ICONS = {
  retail: ShoppingBag,
  restaurant: UtensilsCrossed,
  hospitality: Building2,
} as const;

export default function IndustrySelector() {
  const router = useRouter();
  const setIndustry = useIndustryStore((s) => s.setIndustry);
  const completeOnboarding = useIndustryStore((s) => s.completeOnboarding);

  const handleSelect = (industry: IndustryType) => {
    if (!industry) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIndustry(industry);
    completeOnboarding();
    // Navigate to main app
    router.replace('/(tabs)');
  };

  const industries = Object.values(INDUSTRY_CONFIGS);

  return (
    <View className="flex-1 bg-neutral-950">
      <LinearGradient
        colors={['#0F0F0F', '#1A1A2E', '#16213E']}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Decorative gradient orbs */}
      <View
        className="absolute w-80 h-80 rounded-full opacity-20"
        style={{
          top: -100,
          right: -100,
          backgroundColor: '#8B5CF6',
          transform: [{ scale: 1.5 }],
        }}
      />
      <View
        className="absolute w-64 h-64 rounded-full opacity-15"
        style={{
          bottom: 100,
          left: -80,
          backgroundColor: '#06B6D4',
          transform: [{ scale: 1.5 }],
        }}
      />

      <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
        <View className="flex-1 px-6 justify-center">
          {/* Header */}
          <Animated.View entering={FadeInUp.delay(100).duration(600)} className="items-center mb-10">
            <View className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-violet-500 items-center justify-center mb-4" style={{ backgroundColor: '#06B6D4' }}>
              <Sparkles size={32} color="#FFFFFF" />
            </View>
            <Text className="text-white text-3xl font-bold text-center">
              Choose Your Industry
            </Text>
            <Text className="text-slate-400 text-center mt-3 text-base leading-6">
              Select the type that best matches your business to get a customized inventory experience
            </Text>
          </Animated.View>

          {/* Industry Cards */}
          <View className="gap-4">
            {industries.map((config, index) => {
              const Icon = ICONS[config.id as keyof typeof ICONS];
              return (
                <Animated.View
                  key={config.id}
                  entering={FadeInDown.delay(200 + index * 100).duration(500)}
                >
                  <Pressable
                    className="active:scale-[0.98] active:opacity-90"
                    onPress={() => handleSelect(config.id)}
                  >
                    <LinearGradient
                      colors={['rgba(30, 41, 59, 0.8)', 'rgba(30, 41, 59, 0.4)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{
                        borderRadius: 20,
                        borderWidth: 1,
                        borderColor: 'rgba(100, 116, 139, 0.3)',
                        overflow: 'hidden',
                      }}
                    >
                      <View className="flex-row items-center p-5">
                        <View
                          className="w-14 h-14 rounded-2xl items-center justify-center"
                          style={{ backgroundColor: `${config.color}20` }}
                        >
                          <Icon size={28} color={config.color} />
                        </View>
                        <View className="flex-1 ml-4">
                          <Text className="text-white text-xl font-bold">
                            {config.name}
                          </Text>
                          <Text className="text-slate-400 text-sm mt-1" numberOfLines={2}>
                            {config.description}
                          </Text>
                        </View>
                        <View
                          className="w-10 h-10 rounded-full items-center justify-center"
                          style={{ backgroundColor: `${config.color}15` }}
                        >
                          <ChevronRight size={20} color={config.color} />
                        </View>
                      </View>
                    </LinearGradient>
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>

          {/* Footer hint */}
          <Animated.View
            entering={FadeInUp.delay(600).duration(500)}
            className="items-center mt-10"
          >
            <Text className="text-slate-500 text-sm text-center">
              You can change this later in settings
            </Text>
          </Animated.View>
        </View>
      </SafeAreaView>
    </View>
  );
}
