import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Image,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  ArrowLeft,
  Store,
  Package,
  Send,
  PackageCheck,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  Phone,
  Mail,
  Plus,
  Minus,
} from 'lucide-react-native';
import { api, BACKEND_URL } from '@/lib/api';
import { useIndustryStore, INDUSTRY_CONFIGS } from '@/lib/industry-store';
import type { Order, OrderItem } from '@/shared/contracts';

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const industry = useIndustryStore((s) => s.industry);
  const config = industry ? INDUSTRY_CONFIGS[industry] : null;
  const accentColor = config?.color ?? '#06B6D4';

  // Fetch order details
  const { data: order, isLoading, error } = useQuery({
    queryKey: ['order', id],
    queryFn: () => api.get<Order>(`/api/orders/${id}`),
    enabled: !!id,
  });

  // Submit order mutation
  const submitOrderMutation = useMutation({
    mutationFn: () => api.post<Order>(`/api/orders/${id}/submit`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  // Receive order mutation
  const receiveOrderMutation = useMutation({
    mutationFn: () => api.post<Order>(`/api/orders/${id}/receive`, { updateInventory: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  // Delete order mutation
  const deleteOrderMutation = useMutation({
    mutationFn: () => api.delete(`/api/orders/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    },
  });

  // Update item quantity mutation
  const updateItemMutation = useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) =>
      api.patch(`/api/orders/${id}/items/${itemId}`, { quantity }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] });
    },
  });

  // Delete item mutation
  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) => api.delete(`/api/orders/${id}/items/${itemId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
  });

  const handleDelete = () => {
    Alert.alert(
      'Delete Order',
      'Are you sure you want to delete this order? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteOrderMutation.mutate(),
        },
      ]
    );
  };

  const getImageUrl = (imageUrl: string) => {
    if (imageUrl.startsWith('http')) return imageUrl;
    return `${BACKEND_URL}${imageUrl}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return '#94A3B8';
      case 'submitted':
        return '#F59E0B';
      case 'received':
        return '#10B981';
      case 'cancelled':
        return '#EF4444';
      default:
        return '#64748B';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft':
        return <FileText size={20} color="#94A3B8" />;
      case 'submitted':
        return <Clock size={20} color="#F59E0B" />;
      case 'received':
        return <CheckCircle2 size={20} color="#10B981" />;
      case 'cancelled':
        return <XCircle size={20} color="#EF4444" />;
      default:
        return <FileText size={20} color="#64748B" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft':
        return 'Draft';
      case 'submitted':
        return 'Submitted';
      case 'received':
        return 'Received';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-black items-center justify-center">
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={accentColor} />
      </View>
    );
  }

  if (error || !order) {
    return (
      <View className="flex-1 bg-black items-center justify-center px-6">
        <Stack.Screen options={{ headerShown: false }} />
        <Text className="text-white text-lg font-semibold mb-2">Order Not Found</Text>
        <Text className="text-slate-400 text-center mb-6">
          This order may have been deleted or doesn't exist.
        </Text>
        <Pressable
          className="px-6 py-3 rounded-xl"
          style={{ backgroundColor: accentColor }}
          onPress={() => router.back()}
        >
          <Text className="text-white font-semibold">Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const items = order.items ?? [];
  const totalAmount = items.reduce((sum, item) => sum + (item.totalCost ?? 0), 0);

  return (
    <View className="flex-1 bg-black">
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <View className="px-5 pt-4 pb-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <Pressable
                className="w-10 h-10 rounded-full bg-slate-800 items-center justify-center active:opacity-80"
                onPress={() => router.back()}
              >
                <ArrowLeft size={20} color="#FFFFFF" />
              </Pressable>
              <View>
                <Text className="text-white text-xl font-bold">{order.orderNumber}</Text>
                <Text className="text-slate-400 text-sm">{order.vendor?.name}</Text>
              </View>
            </View>
            <View
              className="px-3 py-1.5 rounded-full flex-row items-center gap-2"
              style={{ backgroundColor: `${getStatusColor(order.status)}20` }}
            >
              {getStatusIcon(order.status)}
              <Text
                className="text-sm font-medium"
                style={{ color: getStatusColor(order.status) }}
              >
                {getStatusLabel(order.status)}
              </Text>
            </View>
          </View>
        </View>

        <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
          {/* Vendor Info Card */}
          <Animated.View entering={FadeInDown.delay(100).springify()}>
            <View className="bg-slate-800/60 rounded-2xl p-4 mb-4 border border-slate-700/50">
              <View className="flex-row items-center gap-3 mb-3">
                <View
                  className="w-12 h-12 rounded-full items-center justify-center"
                  style={{ backgroundColor: `${accentColor}20` }}
                >
                  <Store size={24} color={accentColor} />
                </View>
                <View className="flex-1">
                  <Text className="text-white font-semibold text-lg">
                    {order.vendor?.name}
                  </Text>
                  {order.vendor?.contactName && (
                    <Text className="text-slate-400 text-sm">{order.vendor.contactName}</Text>
                  )}
                </View>
              </View>
              {(order.vendor?.email || order.vendor?.phone) && (
                <View className="flex-row gap-4 mt-2">
                  {order.vendor?.email && (
                    <View className="flex-row items-center gap-2">
                      <Mail size={14} color="#64748B" />
                      <Text className="text-slate-400 text-sm">{order.vendor.email}</Text>
                    </View>
                  )}
                  {order.vendor?.phone && (
                    <View className="flex-row items-center gap-2">
                      <Phone size={14} color="#64748B" />
                      <Text className="text-slate-400 text-sm">{order.vendor.phone}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </Animated.View>

          {/* Order Timeline */}
          <Animated.View entering={FadeInDown.delay(150).springify()}>
            <View className="bg-slate-800/60 rounded-2xl p-4 mb-4 border border-slate-700/50">
              <Text className="text-white font-semibold mb-3">Order Timeline</Text>
              <View className="gap-3">
                <View className="flex-row items-center gap-3">
                  <View className="w-8 h-8 rounded-full bg-slate-700 items-center justify-center">
                    <FileText size={14} color="#94A3B8" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-white text-sm">Created</Text>
                    <Text className="text-slate-400 text-xs">
                      {formatDate(order.createdAt)}
                    </Text>
                  </View>
                </View>
                {order.submittedAt && (
                  <View className="flex-row items-center gap-3">
                    <View className="w-8 h-8 rounded-full bg-amber-500/20 items-center justify-center">
                      <Send size={14} color="#F59E0B" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-white text-sm">Submitted</Text>
                      <Text className="text-slate-400 text-xs">
                        {formatDate(order.submittedAt)}
                      </Text>
                    </View>
                  </View>
                )}
                {order.receivedAt && (
                  <View className="flex-row items-center gap-3">
                    <View className="w-8 h-8 rounded-full bg-emerald-500/20 items-center justify-center">
                      <PackageCheck size={14} color="#10B981" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-white text-sm">Received</Text>
                      <Text className="text-slate-400 text-xs">
                        {formatDate(order.receivedAt)}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </View>
          </Animated.View>

          {/* Order Items */}
          <Animated.View entering={FadeInDown.delay(200).springify()}>
            <View className="mb-4">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-white font-semibold">
                  Items ({items.length})
                </Text>
                {totalAmount > 0 && (
                  <Text className="text-emerald-400 font-bold">
                    ${totalAmount.toFixed(2)}
                  </Text>
                )}
              </View>
              {items.length === 0 ? (
                <View className="bg-slate-800/60 rounded-2xl p-6 items-center border border-slate-700/50">
                  <Package size={32} color="#64748B" />
                  <Text className="text-slate-400 mt-2">No items in this order</Text>
                </View>
              ) : (
                items.map((item, index) => (
                  <Animated.View
                    key={item.id}
                    entering={FadeInDown.delay(250 + index * 50).springify()}
                  >
                    <View className="bg-slate-800/60 rounded-xl p-3 mb-2 border border-slate-700/50">
                      <View className="flex-row items-center gap-3">
                        {item.inventoryItem && (
                          <Image
                            source={{ uri: getImageUrl(item.inventoryItem.imageUrl) }}
                            className="w-14 h-14 rounded-lg bg-slate-700"
                          />
                        )}
                        <View className="flex-1">
                          <Text className="text-white font-medium" numberOfLines={1}>
                            {item.inventoryItem?.name ?? 'Unknown Item'}
                          </Text>
                          <View className="flex-row items-center gap-2 mt-1">
                            {item.unitCost && (
                              <Text className="text-slate-400 text-xs">
                                ${item.unitCost.toFixed(2)} ea
                              </Text>
                            )}
                            {item.totalCost && (
                              <>
                                <Text className="text-slate-500">•</Text>
                                <Text className="text-emerald-400 text-xs font-medium">
                                  ${item.totalCost.toFixed(2)} total
                                </Text>
                              </>
                            )}
                          </View>
                        </View>
                        {order.status === 'draft' ? (
                          <View className="flex-row items-center gap-2">
                            <Pressable
                              className="w-8 h-8 rounded-lg bg-slate-700 items-center justify-center active:opacity-80"
                              onPress={() => {
                                if (item.quantity > 1) {
                                  updateItemMutation.mutate({
                                    itemId: item.id,
                                    quantity: item.quantity - 1,
                                  });
                                }
                              }}
                            >
                              <Minus size={16} color="#FFFFFF" />
                            </Pressable>
                            <Text className="text-white font-bold w-8 text-center">
                              {item.quantity}
                            </Text>
                            <Pressable
                              className="w-8 h-8 rounded-lg bg-slate-700 items-center justify-center active:opacity-80"
                              onPress={() => {
                                updateItemMutation.mutate({
                                  itemId: item.id,
                                  quantity: item.quantity + 1,
                                });
                              }}
                            >
                              <Plus size={16} color="#FFFFFF" />
                            </Pressable>
                            <Pressable
                              className="w-8 h-8 rounded-lg bg-red-500/20 items-center justify-center active:opacity-80 ml-1"
                              onPress={() => deleteItemMutation.mutate(item.id)}
                            >
                              <Trash2 size={16} color="#EF4444" />
                            </Pressable>
                          </View>
                        ) : (
                          <View className="bg-slate-700 px-3 py-1.5 rounded-lg">
                            <Text className="text-white font-bold">x{item.quantity}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </Animated.View>
                ))
              )}
            </View>
          </Animated.View>

          {/* Notes */}
          {order.notes && (
            <Animated.View entering={FadeInDown.delay(300).springify()}>
              <View className="bg-slate-800/60 rounded-2xl p-4 mb-4 border border-slate-700/50">
                <Text className="text-white font-semibold mb-2">Notes</Text>
                <Text className="text-slate-300">{order.notes}</Text>
              </View>
            </Animated.View>
          )}

          {/* Action Buttons */}
          <Animated.View entering={FadeInDown.delay(350).springify()}>
            <View className="gap-3 mb-6">
              {order.status === 'draft' && (
                <>
                  <Pressable
                    className="py-4 rounded-xl items-center active:opacity-90"
                    style={{ backgroundColor: accentColor }}
                    onPress={() => submitOrderMutation.mutate()}
                    disabled={submitOrderMutation.isPending}
                  >
                    {submitOrderMutation.isPending ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <View className="flex-row items-center gap-2">
                        <Send size={20} color="#FFFFFF" />
                        <Text className="text-white font-semibold">Submit Order</Text>
                      </View>
                    )}
                  </Pressable>
                  <Pressable
                    className="py-4 rounded-xl items-center bg-red-500/20 active:opacity-90"
                    onPress={handleDelete}
                    disabled={deleteOrderMutation.isPending}
                  >
                    {deleteOrderMutation.isPending ? (
                      <ActivityIndicator size="small" color="#EF4444" />
                    ) : (
                      <View className="flex-row items-center gap-2">
                        <Trash2 size={20} color="#EF4444" />
                        <Text className="text-red-400 font-semibold">Delete Order</Text>
                      </View>
                    )}
                  </Pressable>
                </>
              )}
              {order.status === 'submitted' && (
                <Pressable
                  className="py-4 rounded-xl items-center bg-emerald-500 active:opacity-90"
                  onPress={() => receiveOrderMutation.mutate()}
                  disabled={receiveOrderMutation.isPending}
                >
                  {receiveOrderMutation.isPending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <View className="flex-row items-center gap-2">
                      <PackageCheck size={20} color="#FFFFFF" />
                      <Text className="text-white font-semibold">Mark as Received</Text>
                    </View>
                  )}
                </Pressable>
              )}
            </View>
          </Animated.View>

          <View className="h-10" />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
