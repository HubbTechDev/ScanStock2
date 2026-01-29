import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  RefreshControl,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  ClipboardCheck,
  ArrowLeft,
  Plus,
  X,
  Check,
  Calendar,
  CheckCircle,
  AlertTriangle,
  Trash2,
  Clock,
} from 'lucide-react-native';
import { api } from '@/lib/api';
import { useIndustryStore, INDUSTRY_CONFIGS } from '@/lib/industry-store';
import type {
  GetCycleCountsResponse,
  CycleCount,
  CreateCycleCountRequest,
} from '@/shared/contracts';

export default function CycleCountsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const industry = useIndustryStore((s) => s.industry);
  const config = industry ? INDUSTRY_CONFIGS[industry] : null;
  const accentColor = config?.color ?? '#06B6D4';

  const [showNewModal, setShowNewModal] = useState(false);
  const [newCountName, setNewCountName] = useState('');
  const [newCountNotes, setNewCountNotes] = useState('');

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['cycle-counts'],
    queryFn: () => api.get<GetCycleCountsResponse>('/api/cycle-counts'),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateCycleCountRequest) =>
      api.post<CycleCount>('/api/cycle-counts', data),
    onSuccess: (newCount) => {
      queryClient.invalidateQueries({ queryKey: ['cycle-counts'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowNewModal(false);
      setNewCountName('');
      setNewCountNotes('');
      // Navigate to the new cycle count
      router.push(`/cycle-count?id=${newCount.id}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/cycle-counts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cycle-counts'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const handleCreateCount = () => {
    if (!newCountName.trim()) {
      Alert.alert('Name Required', 'Please enter a name for this cycle count');
      return;
    }

    createMutation.mutate({
      name: newCountName.trim(),
      notes: newCountNotes.trim() || undefined,
    });
  };

  const handleDeleteCount = (count: CycleCount) => {
    Alert.alert(
      'Delete Cycle Count',
      `Are you sure you want to delete "${count.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(count.id),
        },
      ]
    );
  };

  const cycleCounts = data?.cycleCounts ?? [];
  const inProgressCounts = cycleCounts.filter((c) => c.status === 'in_progress');
  const completedCounts = cycleCounts.filter((c) => c.status === 'completed');

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getDefaultName = () => {
    const now = new Date();
    return `Count - ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  };

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
            <View className="flex-row items-center justify-center gap-2 mb-1">
              <ClipboardCheck size={14} color={accentColor} />
              <Text className="text-xs font-medium" style={{ color: accentColor }}>
                Inventory
              </Text>
            </View>
            <Text className="text-white text-xl font-bold text-center">
              Cycle Counts
            </Text>
          </View>

          <Pressable
            className="w-10 h-10 rounded-full items-center justify-center active:opacity-80"
            style={{ backgroundColor: accentColor }}
            onPress={() => {
              setNewCountName(getDefaultName());
              setShowNewModal(true);
            }}
          >
            <Plus size={20} color="#FFFFFF" />
          </Pressable>
        </View>

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
          ) : cycleCounts.length === 0 ? (
            <View className="bg-slate-800/60 rounded-2xl p-8 items-center border border-slate-700/50">
              <ClipboardCheck size={48} color="#64748B" />
              <Text className="text-white font-bold text-lg mt-4">
                No Cycle Counts Yet
              </Text>
              <Text className="text-slate-400 text-center mt-2 mb-4">
                Start a cycle count to verify your inventory quantities
              </Text>
              <Pressable
                className="rounded-xl px-6 py-3 active:opacity-80"
                style={{ backgroundColor: accentColor }}
                onPress={() => {
                  setNewCountName(getDefaultName());
                  setShowNewModal(true);
                }}
              >
                <Text className="text-white font-bold">Start New Count</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {/* In Progress Section */}
              {inProgressCounts.length > 0 && (
                <View className="mb-6">
                  <View className="flex-row items-center mb-3">
                    <Clock size={16} color="#F59E0B" />
                    <Text className="text-amber-400 font-bold ml-2">
                      In Progress ({inProgressCounts.length})
                    </Text>
                  </View>

                  {inProgressCounts.map((count, index) => (
                    <Animated.View
                      key={count.id}
                      entering={FadeInDown.delay(index * 50).springify()}
                    >
                      <Pressable
                        className="bg-slate-800/70 rounded-2xl p-4 mb-3 border border-amber-500/30 active:opacity-80"
                        onPress={() => router.push(`/cycle-count?id=${count.id}`)}
                      >
                        <View className="flex-row items-start justify-between">
                          <View className="flex-1">
                            <Text className="text-white font-bold text-base">
                              {count.name}
                            </Text>
                            <View className="flex-row items-center mt-1">
                              <Calendar size={12} color="#94A3B8" />
                              <Text className="text-slate-400 text-xs ml-1">
                                Started {formatDate(count.startedAt)}
                              </Text>
                            </View>
                          </View>

                          <Pressable
                            className="w-8 h-8 rounded-lg bg-slate-700/50 items-center justify-center active:opacity-80"
                            onPress={(e) => {
                              e.stopPropagation();
                              handleDeleteCount(count);
                            }}
                          >
                            <Trash2 size={16} color="#EF4444" />
                          </Pressable>
                        </View>

                        {/* Progress */}
                        <View className="mt-3">
                          <View className="flex-row items-center justify-between mb-1">
                            <Text className="text-slate-400 text-xs">Progress</Text>
                            <Text className="text-white text-xs font-medium">
                              {count.countedItems ?? 0}/{count.totalItems ?? 0}
                            </Text>
                          </View>
                          <View className="bg-slate-700/50 h-2 rounded-full overflow-hidden">
                            <View
                              className="h-full rounded-full bg-amber-500"
                              style={{
                                width: `${
                                  count.totalItems
                                    ? ((count.countedItems ?? 0) / count.totalItems) * 100
                                    : 0
                                }%`,
                              }}
                            />
                          </View>
                        </View>

                        {/* Stats */}
                        <View className="flex-row mt-3 gap-4">
                          <View className="flex-row items-center">
                            <CheckCircle size={12} color="#10B981" />
                            <Text className="text-slate-300 text-xs ml-1">
                              {count.countedItems ?? 0} counted
                            </Text>
                          </View>
                          {(count.itemsWithVariance ?? 0) > 0 && (
                            <View className="flex-row items-center">
                              <AlertTriangle size={12} color="#EF4444" />
                              <Text className="text-red-400 text-xs ml-1">
                                {count.itemsWithVariance} variance
                              </Text>
                            </View>
                          )}
                        </View>
                      </Pressable>
                    </Animated.View>
                  ))}
                </View>
              )}

              {/* Completed Section */}
              {completedCounts.length > 0 && (
                <View className="mb-6">
                  <View className="flex-row items-center mb-3">
                    <CheckCircle size={16} color="#10B981" />
                    <Text className="text-emerald-400 font-bold ml-2">
                      Completed ({completedCounts.length})
                    </Text>
                  </View>

                  {completedCounts.map((count, index) => (
                    <Animated.View
                      key={count.id}
                      entering={FadeInDown.delay(index * 50 + 100).springify()}
                    >
                      <Pressable
                        className="bg-slate-800/50 rounded-2xl p-4 mb-3 border border-slate-700/30 active:opacity-80"
                        onPress={() => router.push(`/cycle-count?id=${count.id}`)}
                      >
                        <View className="flex-row items-start justify-between">
                          <View className="flex-1">
                            <View className="flex-row items-center">
                              <Text className="text-white font-bold text-base">
                                {count.name}
                              </Text>
                              <View className="bg-emerald-500/20 px-2 py-0.5 rounded ml-2">
                                <Text className="text-emerald-400 text-xs font-medium">
                                  Done
                                </Text>
                              </View>
                            </View>
                            <View className="flex-row items-center mt-1">
                              <Calendar size={12} color="#94A3B8" />
                              <Text className="text-slate-500 text-xs ml-1">
                                Completed {formatDate(count.completedAt ?? count.updatedAt)}
                              </Text>
                            </View>
                          </View>

                          <Pressable
                            className="w-8 h-8 rounded-lg bg-slate-700/50 items-center justify-center active:opacity-80"
                            onPress={(e) => {
                              e.stopPropagation();
                              handleDeleteCount(count);
                            }}
                          >
                            <Trash2 size={16} color="#64748B" />
                          </Pressable>
                        </View>

                        {/* Summary */}
                        <View className="flex-row mt-3 gap-4">
                          <Text className="text-slate-400 text-xs">
                            {count.totalItems ?? 0} items
                          </Text>
                          {(count.itemsWithVariance ?? 0) > 0 ? (
                            <View className="flex-row items-center">
                              <AlertTriangle size={12} color="#F59E0B" />
                              <Text className="text-amber-400 text-xs ml-1">
                                {count.itemsWithVariance} had variance
                              </Text>
                            </View>
                          ) : (
                            <View className="flex-row items-center">
                              <Check size={12} color="#10B981" />
                              <Text className="text-emerald-400 text-xs ml-1">
                                No variance
                              </Text>
                            </View>
                          )}
                        </View>
                      </Pressable>
                    </Animated.View>
                  ))}
                </View>
              )}
            </>
          )}
          <View className="h-8" />
        </ScrollView>

        {/* New Cycle Count Modal */}
        <Modal visible={showNewModal} transparent animationType="fade">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1"
          >
            <Pressable
              className="flex-1 bg-black/70 justify-center px-5"
              onPress={() => setShowNewModal(false)}
            >
              <Pressable onPress={(e) => e.stopPropagation()}>
                <View className="bg-slate-800 rounded-3xl overflow-hidden">
                  {/* Header */}
                  <View className="p-5 border-b border-slate-700 flex-row items-center justify-between">
                    <Text className="text-white font-bold text-lg">
                      New Cycle Count
                    </Text>
                    <Pressable onPress={() => setShowNewModal(false)}>
                      <X size={24} color="#94A3B8" />
                    </Pressable>
                  </View>

                  <View className="p-5">
                    {/* Name */}
                    <Text className="text-slate-400 text-sm mb-2 font-medium">
                      Count Name
                    </Text>
                    <TextInput
                      className="bg-slate-700/50 rounded-xl px-4 py-3.5 text-white mb-4"
                      placeholder="e.g., Weekly Count - Jan 27"
                      placeholderTextColor="#64748B"
                      value={newCountName}
                      onChangeText={setNewCountName}
                    />

                    {/* Notes */}
                    <Text className="text-slate-400 text-sm mb-2 font-medium">
                      Notes (optional)
                    </Text>
                    <TextInput
                      className="bg-slate-700/50 rounded-xl px-4 py-3.5 text-white mb-6"
                      placeholder="Add any notes..."
                      placeholderTextColor="#64748B"
                      value={newCountNotes}
                      onChangeText={setNewCountNotes}
                      multiline
                    />

                    {/* Info */}
                    <View className="bg-slate-700/30 rounded-xl p-4 mb-6">
                      <Text className="text-slate-300 text-sm">
                        This will create a count with all your current inventory items.
                        You can then count each item and track any variances.
                      </Text>
                    </View>

                    {/* Create Button */}
                    <Pressable
                      className="rounded-xl py-4 items-center active:opacity-80"
                      style={{ backgroundColor: accentColor }}
                      onPress={handleCreateCount}
                      disabled={createMutation.isPending}
                    >
                      <Text className="text-white font-bold text-base">
                        {createMutation.isPending ? 'Creating...' : 'Start Count'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </Pressable>
            </Pressable>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </View>
  );
}
