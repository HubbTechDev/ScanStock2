import React from 'react';
import { View, Text, ScrollView, RefreshControl, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import {
  BarChart3, TrendingUp, TrendingDown, Package, DollarSign,
  ShoppingBag, UtensilsCrossed, Building2, Calendar, AlertTriangle
} from 'lucide-react-native';
import { api } from '@/lib/api';
import { useIndustryStore, INDUSTRY_CONFIGS } from '@/lib/industry-store';
import type { GetInventoryResponse, InventoryItem } from '@/shared/contracts';

const { width } = Dimensions.get('window');

const INDUSTRY_ICONS = {
  retail: ShoppingBag,
  restaurant: UtensilsCrossed,
  hospitality: Building2,
} as const;

export default function AnalyticsScreen() {
  const industry = useIndustryStore((s) => s.industry);
  const config = industry ? INDUSTRY_CONFIGS[industry] : null;

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => api.get<GetInventoryResponse>('/api/inventory'),
  });

  const items: InventoryItem[] = data?.items ?? [];
  const stats = data?.stats ?? { total: 0, pending: 0, completed: 0, sold: 0 };

  const IndustryIcon = industry ? INDUSTRY_ICONS[industry] : Package;
  const accentColor = config?.color ?? '#06B6D4';

  // Calculate analytics
  const totalItems = items.length;
  const activeItems = items.filter((i) => i.status === 'pending').length;
  const completedItems = items.filter((i) => i.status === 'completed').length;

  // Calculate value metrics
  const totalValue = items.reduce((sum, item) => sum + (item.soldPrice ?? 0), 0);
  const avgValue = totalItems > 0 ? totalValue / totalItems : 0;

  // Calculate COGS metrics
  const soldItems = items.filter((i) => i.status === 'completed' || i.status === 'sold');
  const totalCost = items.reduce((sum, item) => sum + (item.cost ?? 0), 0); // Total inventory cost
  const costOfGoodsSold = soldItems.reduce((sum, item) => sum + (item.cost ?? 0), 0); // Cost of sold items
  const revenue = soldItems.reduce((sum, item) => sum + (item.soldPrice ?? 0), 0); // Revenue from sold items
  const grossProfit = revenue - costOfGoodsSold;
  const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const remainingInventoryValue = items
    .filter((i) => i.status === 'pending')
    .reduce((sum, item) => sum + (item.cost ?? 0), 0);

  // Calculate items added this week
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const itemsThisWeek = items.filter(
    (item) => new Date(item.createdAt) >= oneWeekAgo
  ).length;

  // Calculate items added last week for comparison
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const itemsLastWeek = items.filter(
    (item) => {
      const date = new Date(item.createdAt);
      return date >= twoWeeksAgo && date < oneWeekAgo;
    }
  ).length;

  const weeklyChange = itemsLastWeek > 0
    ? ((itemsThisWeek - itemsLastWeek) / itemsLastWeek) * 100
    : itemsThisWeek > 0 ? 100 : 0;

  // Category breakdown (using platform field as proxy)
  const categoryBreakdown = items.reduce<Record<string, number>>((acc, item) => {
    const category = item.platform || 'Uncategorized';
    acc[category] = (acc[category] ?? 0) + 1;
    return acc;
  }, {});

  const topCategories = Object.entries(categoryBreakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const maxCategoryCount = topCategories.length > 0 ? topCategories[0][1] : 1;

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
          <View className="px-5 pt-4 pb-6">
            <View className="flex-row items-center gap-2 mb-1">
              <BarChart3 size={16} color={accentColor} />
              <Text className="text-sm font-medium" style={{ color: accentColor }}>
                {config?.name ?? 'Inventory'} Analytics
              </Text>
            </View>
            <Text className="text-white text-3xl font-bold">Insights</Text>
          </View>

          {/* Overview Stats */}
          <View className="px-5 mb-6">
            <Text className="text-white text-lg font-bold mb-4">Overview</Text>
            <View className="flex-row flex-wrap gap-3">
              {/* Total Items */}
              <View className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/50" style={{ width: (width - 52) / 2 }}>
                <View className="w-10 h-10 rounded-xl items-center justify-center mb-3" style={{ backgroundColor: `${accentColor}20` }}>
                  <IndustryIcon size={20} color={accentColor} />
                </View>
                <Text className="text-slate-400 text-xs font-medium">Total Items</Text>
                <Text className="text-white text-2xl font-bold mt-1">{totalItems}</Text>
              </View>

              {/* Active Items */}
              <View className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/50" style={{ width: (width - 52) / 2 }}>
                <View className="bg-emerald-500/20 w-10 h-10 rounded-xl items-center justify-center mb-3">
                  <Package size={20} color="#10B981" />
                </View>
                <Text className="text-slate-400 text-xs font-medium">Active</Text>
                <Text className="text-white text-2xl font-bold mt-1">{activeItems}</Text>
              </View>

              {/* Total Value */}
              <View className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/50" style={{ width: (width - 52) / 2 }}>
                <View className="bg-cyan-500/20 w-10 h-10 rounded-xl items-center justify-center mb-3">
                  <DollarSign size={20} color="#06B6D4" />
                </View>
                <Text className="text-slate-400 text-xs font-medium">Total Value</Text>
                <Text className="text-cyan-400 text-xl font-bold mt-1">
                  ${totalValue.toLocaleString()}
                </Text>
              </View>

              {/* Avg Value */}
              <View className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/50" style={{ width: (width - 52) / 2 }}>
                <View className="bg-violet-500/20 w-10 h-10 rounded-xl items-center justify-center mb-3">
                  <TrendingUp size={20} color="#8B5CF6" />
                </View>
                <Text className="text-slate-400 text-xs font-medium">Avg Value</Text>
                <Text className="text-violet-400 text-xl font-bold mt-1">
                  ${avgValue.toFixed(2)}
                </Text>
              </View>
            </View>
          </View>

          {/* Weekly Activity */}
          <View className="px-5 mb-6">
            <Text className="text-white text-lg font-bold mb-4">This Week</Text>
            <View className="bg-slate-800/60 rounded-2xl p-5 border border-slate-700/50">
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-slate-400 text-sm">Items Added</Text>
                  <Text className="text-white text-3xl font-bold mt-1">{itemsThisWeek}</Text>
                </View>
                <View className="items-end">
                  <View className="flex-row items-center gap-1">
                    {weeklyChange >= 0 ? (
                      <TrendingUp size={16} color="#10B981" />
                    ) : (
                      <TrendingDown size={16} color="#EF4444" />
                    )}
                    <Text
                      className="font-bold"
                      style={{ color: weeklyChange >= 0 ? '#10B981' : '#EF4444' }}
                    >
                      {weeklyChange >= 0 ? '+' : ''}{weeklyChange.toFixed(0)}%
                    </Text>
                  </View>
                  <Text className="text-slate-500 text-xs mt-1">vs last week</Text>
                </View>
              </View>

              {/* Simple bar visualization */}
              <View className="mt-4 pt-4 border-t border-slate-700/50">
                <View className="flex-row items-end justify-between h-16">
                  {[...Array(7)].map((_, i) => {
                    const dayItems = items.filter((item) => {
                      const date = new Date(item.createdAt);
                      const targetDate = new Date();
                      targetDate.setDate(targetDate.getDate() - (6 - i));
                      return date.toDateString() === targetDate.toDateString();
                    }).length;
                    const maxDayItems = Math.max(...[...Array(7)].map((_, j) => {
                      const d = new Date();
                      d.setDate(d.getDate() - (6 - j));
                      return items.filter((item) => new Date(item.createdAt).toDateString() === d.toDateString()).length;
                    }), 1);
                    const height = (dayItems / maxDayItems) * 48 + 8;
                    const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
                    const targetDate = new Date();
                    targetDate.setDate(targetDate.getDate() - (6 - i));
                    const dayLabel = dayLabels[targetDate.getDay()];

                    return (
                      <View key={i} className="items-center flex-1">
                        <View
                          className="w-6 rounded-t-lg"
                          style={{
                            height,
                            backgroundColor: i === 6 ? accentColor : `${accentColor}40`,
                          }}
                        />
                        <Text className="text-slate-500 text-xs mt-2">{dayLabel}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>
          </View>

          {/* COGS Section */}
          <View className="px-5 mb-6">
            <Text className="text-white text-lg font-bold mb-4">Cost of Goods Sold</Text>
            <View className="bg-slate-800/60 rounded-2xl p-5 border border-slate-700/50">
              {/* Main COGS Stats */}
              <View className="flex-row gap-3 mb-4">
                <View className="flex-1 bg-slate-700/50 rounded-xl p-3">
                  <Text className="text-slate-400 text-xs">Revenue</Text>
                  <Text className="text-emerald-400 text-lg font-bold">${revenue.toLocaleString()}</Text>
                </View>
                <View className="flex-1 bg-slate-700/50 rounded-xl p-3">
                  <Text className="text-slate-400 text-xs">COGS</Text>
                  <Text className="text-amber-400 text-lg font-bold">${costOfGoodsSold.toLocaleString()}</Text>
                </View>
              </View>

              {/* Gross Profit Highlight */}
              <View className="bg-gradient-to-r rounded-xl p-4 mb-4" style={{ backgroundColor: grossProfit >= 0 ? '#10B98115' : '#EF444415' }}>
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-slate-400 text-sm">Gross Profit</Text>
                    <Text
                      className="text-2xl font-bold"
                      style={{ color: grossProfit >= 0 ? '#10B981' : '#EF4444' }}
                    >
                      {grossProfit >= 0 ? '+' : '-'}${Math.abs(grossProfit).toLocaleString()}
                    </Text>
                  </View>
                  <View className="items-end">
                    <View className="flex-row items-center gap-1">
                      {grossProfit >= 0 ? (
                        <TrendingUp size={16} color="#10B981" />
                      ) : (
                        <TrendingDown size={16} color="#EF4444" />
                      )}
                      <Text
                        className="font-bold"
                        style={{ color: grossProfit >= 0 ? '#10B981' : '#EF4444' }}
                      >
                        {grossMargin.toFixed(1)}%
                      </Text>
                    </View>
                    <Text className="text-slate-500 text-xs mt-1">margin</Text>
                  </View>
                </View>
              </View>

              {/* Inventory Cost Breakdown */}
              <View className="border-t border-slate-700/50 pt-4">
                <Text className="text-slate-400 text-sm mb-3">Inventory Cost Breakdown</Text>
                <View className="flex-row justify-between mb-2">
                  <Text className="text-slate-300 text-sm">Total Inventory Cost</Text>
                  <Text className="text-white font-medium">${totalCost.toLocaleString()}</Text>
                </View>
                <View className="flex-row justify-between mb-2">
                  <Text className="text-slate-300 text-sm">Cost of Sold Items</Text>
                  <Text className="text-amber-400 font-medium">-${costOfGoodsSold.toLocaleString()}</Text>
                </View>
                <View className="flex-row justify-between pt-2 border-t border-slate-700/30">
                  <Text className="text-slate-300 text-sm font-medium">Remaining Inventory Value</Text>
                  <Text className="text-cyan-400 font-bold">${remainingInventoryValue.toLocaleString()}</Text>
                </View>
              </View>

              {/* Items Breakdown */}
              <View className="border-t border-slate-700/50 pt-4 mt-4">
                <View className="flex-row justify-between items-center">
                  <Text className="text-slate-400 text-sm">Items Sold</Text>
                  <Text className="text-white font-medium">{soldItems.length}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Category Breakdown */}
          <View className="px-5 mb-6">
            <Text className="text-white text-lg font-bold mb-4">
              {industry === 'retail' ? 'By Category' : industry === 'restaurant' ? 'By Type' : 'By Location'}
            </Text>
            <View className="bg-slate-800/60 rounded-2xl p-5 border border-slate-700/50">
              {topCategories.length === 0 ? (
                <View className="items-center py-4">
                  <AlertTriangle size={24} color="#64748B" />
                  <Text className="text-slate-400 mt-2">No data available</Text>
                </View>
              ) : (
                topCategories.map(([category, count], index) => (
                  <View key={category} className={index > 0 ? 'mt-4' : ''}>
                    <View className="flex-row items-center justify-between mb-2">
                      <Text className="text-white font-medium">{category}</Text>
                      <Text className="text-slate-400 text-sm">{count} items</Text>
                    </View>
                    <View className="bg-slate-700/50 h-2 rounded-full overflow-hidden">
                      <View
                        className="h-full rounded-full"
                        style={{
                          width: `${(count / maxCategoryCount) * 100}%`,
                          backgroundColor: accentColor,
                        }}
                      />
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>

          {/* Status Breakdown */}
          <View className="px-5 mb-8">
            <Text className="text-white text-lg font-bold mb-4">Status Distribution</Text>
            <View className="bg-slate-800/60 rounded-2xl p-5 border border-slate-700/50">
              <View className="flex-row items-center justify-around">
                <View className="items-center">
                  <View className="w-16 h-16 rounded-full items-center justify-center" style={{ backgroundColor: '#10B98120' }}>
                    <Text className="text-emerald-400 text-xl font-bold">{stats.pending}</Text>
                  </View>
                  <Text className="text-slate-400 text-sm mt-2">Active</Text>
                </View>
                <View className="items-center">
                  <View className="w-16 h-16 rounded-full items-center justify-center" style={{ backgroundColor: '#F59E0B20' }}>
                    <Text className="text-amber-400 text-xl font-bold">{stats.sold}</Text>
                  </View>
                  <Text className="text-slate-400 text-sm mt-2">Pending</Text>
                </View>
                <View className="items-center">
                  <View className="w-16 h-16 rounded-full items-center justify-center" style={{ backgroundColor: '#8B5CF620' }}>
                    <Text className="text-violet-400 text-xl font-bold">{stats.completed}</Text>
                  </View>
                  <Text className="text-slate-400 text-sm mt-2">Completed</Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
