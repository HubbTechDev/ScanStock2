import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  RefreshControl,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  ClipboardCheck,
  ArrowLeft,
  Check,
  X,
  Minus,
  Plus,
  AlertTriangle,
  CheckCircle,
  Package,
  MapPin,
  Search,
  Filter,
} from 'lucide-react-native';
import { api, BACKEND_URL } from '@/lib/api';
import { useIndustryStore, INDUSTRY_CONFIGS } from '@/lib/industry-store';
import type {
  GetCycleCountResponse,
  CycleCountItem,
  RecordCountRequest,
} from '@/shared/contracts';

type FilterType = 'all' | 'uncounted' | 'counted' | 'variance';

interface CountItemCardProps {
  item: CycleCountItem;
  accentColor: string;
  onRecordCount: (itemId: string, count: number, notes?: string) => void;
  index: number;
}

function CountItemCard({ item, accentColor, onRecordCount, index }: CountItemCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [countValue, setCountValue] = useState(
    item.countedQty !== null ? String(item.countedQty) : String(item.expectedQty)
  );
  const [notes, setNotes] = useState(item.notes ?? '');

  const isCounted = item.countedQty !== null;
  const hasVariance = item.variance !== null && item.variance !== 0;

  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handleQuickCount = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    scale.value = withSpring(0.97, {}, () => {
      scale.value = withSpring(1);
    });
    // Quick count - confirm expected quantity
    onRecordCount(item.inventoryItemId, item.expectedQty);
  }, [item.inventoryItemId, item.expectedQty, onRecordCount, scale]);

  const handleSaveCount = useCallback(() => {
    const count = parseInt(countValue, 10);
    if (isNaN(count) || count < 0) {
      Alert.alert('Invalid Count', 'Please enter a valid quantity');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onRecordCount(item.inventoryItemId, count, notes || undefined);
    setIsEditing(false);
  }, [countValue, notes, item.inventoryItemId, onRecordCount]);

  const incrementCount = () => {
    const current = parseInt(countValue, 10) || 0;
    setCountValue(String(current + 1));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const decrementCount = () => {
    const current = parseInt(countValue, 10) || 0;
    if (current > 0) {
      setCountValue(String(current - 1));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const getImageUrl = (imageUrl: string) => {
    if (imageUrl.startsWith('http')) return imageUrl;
    return `${BACKEND_URL}${imageUrl}`;
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 30).springify()}
      style={animatedStyle}
    >
      <Pressable
        className="bg-slate-800/70 rounded-2xl p-4 mb-3 border"
        style={{
          borderColor: hasVariance
            ? '#EF444430'
            : isCounted
              ? '#10B98130'
              : '#33415530',
        }}
        onPress={() => setIsEditing(true)}
      >
        <View className="flex-row">
          {/* Item Image */}
          {item.inventoryItem && (
            <Image
              source={{ uri: getImageUrl(item.inventoryItem.imageUrl) }}
              className="w-16 h-16 rounded-xl bg-slate-700 mr-3"
            />
          )}

          {/* Item Info */}
          <View className="flex-1">
            <Text className="text-white font-bold text-base" numberOfLines={1}>
              {item.inventoryItem?.name ?? 'Unknown Item'}
            </Text>

            {/* Location */}
            {item.inventoryItem && (item.inventoryItem.binNumber || item.inventoryItem.rackNumber) && (
              <View className="flex-row items-center mt-1 gap-2">
                {item.inventoryItem.binNumber ? (
                  <View className="flex-row items-center">
                    <MapPin size={10} color="#94A3B8" />
                    <Text className="text-slate-400 text-xs ml-1">{item.inventoryItem.binNumber}</Text>
                  </View>
                ) : null}
                {item.inventoryItem.rackNumber ? (
                  <Text className="text-slate-500 text-xs">{item.inventoryItem.rackNumber}</Text>
                ) : null}
              </View>
            )}

            {/* Count Status */}
            <View className="flex-row items-center mt-2 gap-3">
              <View className="bg-slate-700/50 px-2 py-1 rounded">
                <Text className="text-slate-300 text-xs">
                  Expected: <Text className="font-bold">{item.expectedQty}</Text>
                </Text>
              </View>

              {isCounted && (
                <View
                  className="px-2 py-1 rounded"
                  style={{
                    backgroundColor: hasVariance ? '#EF444420' : '#10B98120',
                  }}
                >
                  <Text
                    className="text-xs font-bold"
                    style={{ color: hasVariance ? '#EF4444' : '#10B981' }}
                  >
                    Counted: {item.countedQty}
                  </Text>
                </View>
              )}

              {hasVariance && (
                <View className="bg-red-500/20 px-2 py-1 rounded flex-row items-center">
                  <AlertTriangle size={10} color="#EF4444" />
                  <Text className="text-red-400 text-xs font-bold ml-1">
                    {item.variance! > 0 ? '+' : ''}{item.variance}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Quick Action */}
          <View className="justify-center">
            {!isCounted ? (
              <Pressable
                className="w-12 h-12 rounded-xl items-center justify-center active:opacity-80"
                style={{ backgroundColor: accentColor }}
                onPress={handleQuickCount}
              >
                <Check size={20} color="#FFFFFF" />
              </Pressable>
            ) : (
              <View className="w-12 h-12 rounded-xl items-center justify-center bg-emerald-500/20">
                <CheckCircle size={20} color="#10B981" />
              </View>
            )}
          </View>
        </View>

        {/* Notes if present */}
        {item.notes && (
          <Text className="text-slate-500 text-xs mt-2 italic">{item.notes}</Text>
        )}
      </Pressable>

      {/* Edit Count Modal */}
      <Modal visible={isEditing} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <Pressable
            className="flex-1 bg-black/70 justify-end"
            onPress={() => setIsEditing(false)}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View className="bg-slate-800 rounded-t-3xl">
                {/* Header */}
                <View className="p-5 border-b border-slate-700 flex-row items-center justify-between">
                  <Text className="text-white font-bold text-lg">
                    Count Item
                  </Text>
                  <Pressable onPress={() => setIsEditing(false)}>
                    <X size={24} color="#94A3B8" />
                  </Pressable>
                </View>

                <View className="p-5">
                  {/* Item Name */}
                  <Text className="text-white text-lg font-semibold mb-1">
                    {item.inventoryItem?.name ?? 'Unknown Item'}
                  </Text>
                  <Text className="text-slate-400 text-sm mb-6">
                    Expected quantity: {item.expectedQty}
                  </Text>

                  {/* Count Input */}
                  <Text className="text-slate-400 text-sm mb-2 font-medium">
                    Actual Count
                  </Text>
                  <View className="flex-row items-center mb-4">
                    <Pressable
                      className="w-14 h-14 rounded-xl bg-slate-700 items-center justify-center active:opacity-80"
                      onPress={decrementCount}
                    >
                      <Minus size={24} color="#FFFFFF" />
                    </Pressable>

                    <TextInput
                      className="flex-1 mx-3 bg-slate-700/50 rounded-xl text-white text-center text-2xl font-bold py-3"
                      value={countValue}
                      onChangeText={setCountValue}
                      keyboardType="number-pad"
                      selectTextOnFocus
                    />

                    <Pressable
                      className="w-14 h-14 rounded-xl bg-slate-700 items-center justify-center active:opacity-80"
                      onPress={incrementCount}
                    >
                      <Plus size={24} color="#FFFFFF" />
                    </Pressable>
                  </View>

                  {/* Variance Preview */}
                  {countValue && (
                    <View className="mb-4">
                      {parseInt(countValue, 10) !== item.expectedQty ? (
                        <View className="bg-amber-500/20 rounded-xl p-3 flex-row items-center">
                          <AlertTriangle size={16} color="#F59E0B" />
                          <Text className="text-amber-400 ml-2">
                            Variance: {parseInt(countValue, 10) - item.expectedQty > 0 ? '+' : ''}
                            {parseInt(countValue, 10) - item.expectedQty}
                          </Text>
                        </View>
                      ) : (
                        <View className="bg-emerald-500/20 rounded-xl p-3 flex-row items-center">
                          <CheckCircle size={16} color="#10B981" />
                          <Text className="text-emerald-400 ml-2">
                            Matches expected quantity
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Notes */}
                  <Text className="text-slate-400 text-sm mb-2 font-medium">
                    Notes (optional)
                  </Text>
                  <TextInput
                    className="bg-slate-700/50 rounded-xl px-4 py-3 text-white mb-6"
                    placeholder="Add notes about this count..."
                    placeholderTextColor="#64748B"
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                  />

                  {/* Save Button */}
                  <Pressable
                    className="rounded-xl py-4 items-center active:opacity-80"
                    style={{ backgroundColor: accentColor }}
                    onPress={handleSaveCount}
                  >
                    <Text className="text-white font-bold text-base">
                      Save Count
                    </Text>
                  </Pressable>
                </View>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </Animated.View>
  );
}

export default function CycleCountDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();

  const industry = useIndustryStore((s) => s.industry);
  const config = industry ? INDUSTRY_CONFIGS[industry] : null;
  const accentColor = config?.color ?? '#06B6D4';

  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [showFilterModal, setShowFilterModal] = useState(false);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['cycle-count', id],
    queryFn: () => api.get<GetCycleCountResponse>(`/api/cycle-counts/${id}`),
    enabled: !!id,
  });

  const recordCountMutation = useMutation({
    mutationFn: ({ itemId, count, notes }: { itemId: string; count: number; notes?: string }) =>
      api.post<CycleCountItem>(`/api/cycle-counts/${id}/items/${itemId}/count`, {
        countedQty: count,
        notes,
      } satisfies RecordCountRequest),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cycle-count', id] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const completeMutation = useMutation({
    mutationFn: (applyChanges: boolean) =>
      api.post(`/api/cycle-counts/${id}/complete`, { applyChanges }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cycle-counts'] });
      queryClient.invalidateQueries({ queryKey: ['cycle-count', id] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    },
  });

  const { mutate: recordCount } = recordCountMutation;

  const handleRecordCount = useCallback(
    (itemId: string, count: number, notes?: string) => {
      recordCount({ itemId, count, notes });
    },
    [recordCount]
  );

  const handleComplete = () => {
    if (!data) return;

    const uncountedItems = data.items.filter((i) => i.countedQty === null);
    if (uncountedItems.length > 0) {
      Alert.alert(
        'Incomplete Count',
        `${uncountedItems.length} items haven't been counted yet. Do you want to continue anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Complete Anyway',
            onPress: () => showApplyChangesAlert(),
          },
        ]
      );
    } else {
      showApplyChangesAlert();
    }
  };

  const showApplyChangesAlert = () => {
    const itemsWithVariance = data?.items.filter(
      (i) => i.variance !== null && i.variance !== 0
    ).length ?? 0;

    Alert.alert(
      'Complete Cycle Count',
      itemsWithVariance > 0
        ? `Apply quantity changes to ${itemsWithVariance} items with variance?`
        : 'No variances found. Complete this count?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete Without Applying',
          onPress: () => completeMutation.mutate(false),
        },
        {
          text: 'Apply Changes',
          style: 'default',
          onPress: () => completeMutation.mutate(true),
        },
      ]
    );
  };

  // Filter items
  const filteredItems = (data?.items ?? []).filter((item) => {
    // Text search
    const matchesSearch =
      searchQuery === '' ||
      item.inventoryItem?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.inventoryItem?.binNumber?.toLowerCase().includes(searchQuery.toLowerCase());

    // Status filter
    let matchesFilter = true;
    switch (filter) {
      case 'uncounted':
        matchesFilter = item.countedQty === null;
        break;
      case 'counted':
        matchesFilter = item.countedQty !== null;
        break;
      case 'variance':
        matchesFilter = item.variance !== null && item.variance !== 0;
        break;
    }

    return matchesSearch && matchesFilter;
  });

  const totalItems = data?.totalItems ?? 0;
  const countedItems = data?.countedItems ?? 0;
  const itemsWithVariance = data?.itemsWithVariance ?? 0;
  const progress = totalItems > 0 ? (countedItems / totalItems) * 100 : 0;

  const isCompleted = data?.status === 'completed';

  return (
    <View className="flex-1 bg-neutral-900">
      <LinearGradient
        colors={['#1C1C1E', '#2C2C2E', '#1C1C1E']}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />
      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <View className="px-5 pt-4 pb-4 flex-row items-center justify-between">
          <Pressable
            className="w-10 h-10 rounded-full bg-slate-800 items-center justify-center active:opacity-80"
            onPress={() => router.back()}
          >
            <ArrowLeft size={20} color="#F8FAFC" />
          </Pressable>

          <View className="flex-1 mx-4">
            <Text className="text-white text-lg font-bold text-center" numberOfLines={1}>
              {data?.name ?? 'Cycle Count'}
            </Text>
            {isCompleted && (
              <Text className="text-emerald-400 text-xs text-center">Completed</Text>
            )}
          </View>

          {!isCompleted && (
            <Pressable
              className="px-4 py-2 rounded-xl active:opacity-80"
              style={{ backgroundColor: accentColor }}
              onPress={handleComplete}
              disabled={completeMutation.isPending}
            >
              <Text className="text-white font-bold">
                {completeMutation.isPending ? '...' : 'Finish'}
              </Text>
            </Pressable>
          )}
          {isCompleted && <View className="w-16" />}
        </View>

        {/* Progress Stats */}
        <Animated.View entering={FadeInUp.springify()} className="px-5 mb-4">
          <View className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/50">
            {/* Progress Bar */}
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-slate-400 text-sm">Progress</Text>
              <Text className="text-white font-bold">
                {countedItems}/{totalItems}
              </Text>
            </View>
            <View className="bg-slate-700/50 h-3 rounded-full overflow-hidden mb-4">
              <View
                className="h-full rounded-full"
                style={{
                  width: `${progress}%`,
                  backgroundColor: progress === 100 ? '#10B981' : accentColor,
                }}
              />
            </View>

            {/* Stats Row */}
            <View className="flex-row justify-around">
              <View className="items-center">
                <Text className="text-2xl font-bold text-white">{totalItems}</Text>
                <Text className="text-slate-400 text-xs">Total</Text>
              </View>
              <View className="items-center">
                <Text className="text-2xl font-bold text-emerald-400">{countedItems}</Text>
                <Text className="text-slate-400 text-xs">Counted</Text>
              </View>
              <View className="items-center">
                <Text className="text-2xl font-bold text-amber-400">
                  {totalItems - countedItems}
                </Text>
                <Text className="text-slate-400 text-xs">Remaining</Text>
              </View>
              <View className="items-center">
                <Text className="text-2xl font-bold text-red-400">{itemsWithVariance}</Text>
                <Text className="text-slate-400 text-xs">Variance</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Search & Filter */}
        <View className="px-5 mb-4">
          <View className="flex-row items-center gap-2">
            <View className="flex-1 bg-slate-800/60 rounded-xl flex-row items-center px-4 border border-slate-700/50">
              <Search size={20} color="#64748B" />
              <TextInput
                className="flex-1 py-3 px-3 text-white"
                placeholder="Search items..."
                placeholderTextColor="#64748B"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
            <Pressable
              className="bg-slate-800/60 w-12 h-12 rounded-xl items-center justify-center border border-slate-700/50 active:opacity-80"
              onPress={() => setShowFilterModal(true)}
            >
              <Filter
                size={20}
                color={filter !== 'all' ? accentColor : '#64748B'}
              />
            </Pressable>
          </View>

          {filter !== 'all' && (
            <Pressable
              className="mt-2 rounded-lg px-3 py-2 flex-row items-center justify-between"
              style={{ backgroundColor: `${accentColor}20` }}
              onPress={() => setFilter('all')}
            >
              <Text style={{ color: accentColor }} className="text-sm capitalize">
                Showing: {filter}
              </Text>
              <X size={16} color={accentColor} />
            </Pressable>
          )}
        </View>

        {/* Items List */}
        <ScrollView
          className="flex-1 px-5"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={accentColor}
            />
          }
        >
          {isLoading ? (
            <View className="bg-slate-800/60 rounded-2xl p-8 items-center border border-slate-700/50">
              <Text className="text-slate-400">Loading...</Text>
            </View>
          ) : filteredItems.length === 0 ? (
            <View className="bg-slate-800/60 rounded-2xl p-8 items-center border border-slate-700/50">
              <Package size={40} color="#64748B" />
              <Text className="text-slate-400 mt-3 text-center">
                {searchQuery || filter !== 'all'
                  ? 'No matching items'
                  : 'No items in this count'}
              </Text>
            </View>
          ) : (
            filteredItems.map((item, index) => (
              <CountItemCard
                key={item.id}
                item={item}
                accentColor={accentColor}
                onRecordCount={handleRecordCount}
                index={index}
              />
            ))
          )}
          <View className="h-8" />
        </ScrollView>

        {/* Filter Modal */}
        <Modal visible={showFilterModal} transparent animationType="fade">
          <Pressable
            className="flex-1 bg-black/60 justify-end"
            onPress={() => setShowFilterModal(false)}
          >
            <View className="bg-slate-800 rounded-t-3xl">
              <View className="p-4 border-b border-slate-700 flex-row items-center justify-between">
                <Text className="text-white font-bold text-lg">Filter Items</Text>
                {filter !== 'all' && (
                  <Pressable onPress={() => setFilter('all')}>
                    <Text style={{ color: accentColor }} className="font-medium">
                      Clear
                    </Text>
                  </Pressable>
                )}
              </View>
              <View className="p-4">
                {(['all', 'uncounted', 'counted', 'variance'] as FilterType[]).map((f) => (
                  <Pressable
                    key={f}
                    className="py-3 px-4 rounded-xl mb-1 flex-row justify-between items-center"
                    style={filter === f ? { backgroundColor: `${accentColor}20` } : {}}
                    onPress={() => {
                      setFilter(f);
                      setShowFilterModal(false);
                    }}
                  >
                    <Text
                      className={`text-base capitalize ${filter === f ? 'font-bold' : ''}`}
                      style={{ color: filter === f ? accentColor : '#F8FAFC' }}
                    >
                      {f === 'all' ? 'All Items' : f === 'variance' ? 'With Variance' : f}
                    </Text>
                    {filter === f && <Check size={18} color={accentColor} />}
                  </Pressable>
                ))}
              </View>
              <View className="h-8" />
            </View>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </View>
  );
}
