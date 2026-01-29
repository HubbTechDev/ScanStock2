import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Image, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Package, Camera, Search, Menu, Settings2,
  ShoppingBag, UtensilsCrossed, Building2, MapPin
} from 'lucide-react-native';
import { api, BACKEND_URL } from '@/lib/api';
import { useSidebar } from '@/lib/sidebarContext';
import { useIndustryStore, INDUSTRY_CONFIGS } from '@/lib/industry-store';
import { useDashboardStore, AVAILABLE_METRICS } from '@/lib/dashboard-store';
import { MetricCard } from '@/components/MetricCard';
import { CustomizeMetricsModal } from '@/components/CustomizeMetricsModal';
import type { GetInventoryResponse, InventoryItem } from '@/shared/contracts';

const INDUSTRY_ICONS = {
  retail: ShoppingBag,
  restaurant: UtensilsCrossed,
  hospitality: Building2,
} as const;

export default function HomeScreen() {
  const router = useRouter();
  const { openSidebar } = useSidebar();
  const industry = useIndustryStore((s) => s.industry);
  const config = industry ? INDUSTRY_CONFIGS[industry] : null;
  const selectedMetrics = useDashboardStore((s) => s.selectedMetrics);
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => api.get<GetInventoryResponse>('/api/inventory'),
    refetchOnMount: 'always',
  });

  const stats = data?.stats ?? { total: 0, pending: 0, completed: 0, sold: 0 };
  const items = data?.items ?? [];

  const getImageUrl = (imageUrl: string) => {
    if (imageUrl.startsWith('http')) return imageUrl;
    return `${BACKEND_URL}${imageUrl}`;
  };

  const IndustryIcon = industry ? INDUSTRY_ICONS[industry] : Package;
  const accentColor = config?.color ?? '#06B6D4';

  // Get recent items
  const activeItems = items.filter((item) => item.status === 'pending');
  const recentItems = [...activeItems]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <View className="flex-1 bg-neutral-900">
      <LinearGradient
        colors={['#1C1C1E', '#2C2C2E', '#1C1C1E']}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />
      <SafeAreaView className="flex-1" edges={['top']}>
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={accentColor}
            />
          }
        >
          {/* Header */}
          <View className="px-5 pt-4 pb-6 flex-row items-start justify-between">
            <View>
              <View className="flex-row items-center gap-2 mb-1">
                <IndustryIcon size={16} color={accentColor} />
                <Text className="text-sm font-medium" style={{ color: accentColor }}>
                  {config?.name ?? 'Inventory'}
                </Text>
              </View>
              <Text className="text-white text-3xl font-bold">Dashboard</Text>
            </View>
            <Pressable
              className="w-10 h-10 rounded-full bg-slate-800 items-center justify-center active:opacity-80"
              onPress={openSidebar}
            >
              <Menu size={20} color="#94A3B8" />
            </Pressable>
          </View>

          {/* Customizable Stats Cards - Vertical Grid */}
          <View className="px-5 mb-2">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-white text-lg font-bold">Metrics</Text>
              <Pressable
                className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 active:opacity-80"
                onPress={() => setShowCustomizeModal(true)}
              >
                <Settings2 size={14} color={accentColor} />
                <Text className="text-sm font-medium" style={{ color: accentColor }}>
                  Customize
                </Text>
              </Pressable>
            </View>

            {selectedMetrics.length > 0 ? (
              <View className="gap-3">
                {/* Render metrics in rows of 2 */}
                {Array.from({ length: Math.ceil(selectedMetrics.length / 2) }).map((_, rowIndex) => {
                  const firstMetricId = selectedMetrics[rowIndex * 2];
                  const secondMetricId = selectedMetrics[rowIndex * 2 + 1];
                  const firstConfig = AVAILABLE_METRICS.find((m) => m.id === firstMetricId);
                  const secondConfig = secondMetricId ? AVAILABLE_METRICS.find((m) => m.id === secondMetricId) : null;

                  return (
                    <View key={rowIndex} className="flex-row gap-3">
                      {firstConfig && (
                        <MetricCard
                          config={firstConfig}
                          items={items}
                          stats={stats}
                          fullWidth
                        />
                      )}
                      {secondConfig ? (
                        <MetricCard
                          config={secondConfig}
                          items={items}
                          stats={stats}
                          fullWidth
                        />
                      ) : (
                        <View className="flex-1" />
                      )}
                    </View>
                  );
                })}
              </View>
            ) : (
              <View className="bg-slate-800/60 rounded-2xl p-6 items-center border border-slate-700/50">
                <Settings2 size={32} color="#64748B" />
                <Text className="text-slate-400 mt-3 text-center">No metrics selected</Text>
                <Pressable
                  className="mt-3 px-4 py-2 rounded-lg"
                  style={{ backgroundColor: accentColor }}
                  onPress={() => setShowCustomizeModal(true)}
                >
                  <Text className="text-white font-semibold">Add Metrics</Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* Quick Actions */}
          <View className="px-5 mt-8">
            <Text className="text-white text-lg font-bold mb-4">Quick Actions</Text>
            <View className="flex-row gap-3">
              <Pressable
                className="flex-1 rounded-2xl p-4 flex-row items-center justify-center gap-2 active:opacity-80"
                style={{ backgroundColor: accentColor }}
                onPress={() => router.push('/add-item')}
              >
                <Camera size={20} color="#FFFFFF" />
                <Text className="text-white font-bold">Add Item</Text>
              </Pressable>
              <Pressable
                className="flex-1 bg-slate-700 rounded-2xl p-4 flex-row items-center justify-center gap-2 active:opacity-80"
                onPress={() => router.push('/(tabs)/search')}
              >
                <Search size={20} color="#FFFFFF" />
                <Text className="text-white font-bold">Find Item</Text>
              </Pressable>
            </View>
          </View>

          {/* Recent Items */}
          <View className="px-5 mt-8 pb-8">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-white text-lg font-bold">Recently Added</Text>
              <Pressable onPress={() => router.push('/(tabs)/inventory')}>
                <Text style={{ color: accentColor }} className="text-sm font-medium">
                  View All
                </Text>
              </Pressable>
            </View>

            {isLoading ? (
              <View className="bg-slate-800/60 rounded-2xl p-8 items-center border border-slate-700/50">
                <Text className="text-slate-400">Loading...</Text>
              </View>
            ) : recentItems.length === 0 ? (
              <View className="bg-slate-800/60 rounded-2xl p-8 items-center border border-slate-700/50">
                <Package size={40} color="#64748B" />
                <Text className="text-slate-400 mt-3 text-center">No items yet</Text>
                <Text className="text-slate-500 text-sm mt-1 text-center">
                  Add your first item to get started
                </Text>
              </View>
            ) : (
              recentItems.map((item) => (
                <Pressable
                  key={item.id}
                  className="bg-slate-800/60 rounded-2xl p-4 mb-3 flex-row items-center border border-slate-700/50 active:opacity-80"
                  onPress={() => router.push(`/item/${item.id}`)}
                >
                  <Image
                    source={{ uri: getImageUrl(item.imageUrl) }}
                    className="w-16 h-16 rounded-xl bg-slate-700"
                  />
                  <View className="flex-1 ml-4">
                    <Text className="text-white font-bold text-base" numberOfLines={1}>
                      {item.name}
                    </Text>
                    <View className="flex-row items-center mt-1">
                      <MapPin size={12} color="#64748B" />
                      <Text className="text-slate-400 text-xs ml-1">
                        {item.binNumber || item.rackNumber
                          ? `${item.binNumber || ''} ${item.rackNumber ? `• ${item.rackNumber}` : ''}`
                          : 'No location set'
                        }
                      </Text>
                    </View>
                    {item.platform && (
                      <Text style={{ color: accentColor }} className="text-xs mt-1">
                        {item.platform}
                      </Text>
                    )}
                  </View>
                  <View
                    className="px-3 py-1.5 rounded-full"
                    style={{ backgroundColor: `${accentColor}20` }}
                  >
                    <Text style={{ color: accentColor }} className="text-xs font-semibold">
                      Active
                    </Text>
                  </View>
                </Pressable>
              ))
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Customize Metrics Modal */}
      <CustomizeMetricsModal
        visible={showCustomizeModal}
        onClose={() => setShowCustomizeModal(false)}
      />
    </View>
  );
}
