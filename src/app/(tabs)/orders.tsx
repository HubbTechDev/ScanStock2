import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Modal,
  Image,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  ShoppingCart,
  Plus,
  Store,
  Package,
  ChevronRight,
  X,
  Check,
  Trash2,
  Send,
  PackageCheck,
  AlertCircle,
  Minus,
  Building2,
  Phone,
  Mail,
} from 'lucide-react-native';
import { api, BACKEND_URL } from '@/lib/api';
import { useIndustryStore, INDUSTRY_CONFIGS } from '@/lib/industry-store';
import type {
  GetVendorsResponse,
  GetOrdersResponse,
  GetBelowParItemsResponse,
  Vendor,
  Order,
  CreateOrderRequest,
  InventoryItem,
} from '@/shared/contracts';

type OrderItemInput = {
  inventoryItemId: string;
  inventoryItem: InventoryItem;
  quantity: number;
  unitCost?: number;
};

export default function OrdersScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const industry = useIndustryStore((s) => s.industry);
  const config = industry ? INDUSTRY_CONFIGS[industry] : null;
  const accentColor = config?.color ?? '#06B6D4';

  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItemInput[]>([]);
  const [orderNotes, setOrderNotes] = useState('');
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [showAddVendorModal, setShowAddVendorModal] = useState(false);
  const [newVendorName, setNewVendorName] = useState('');
  const [newVendorEmail, setNewVendorEmail] = useState('');
  const [newVendorPhone, setNewVendorPhone] = useState('');

  // Fetch vendors
  const { data: vendorsData, isLoading: vendorsLoading } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => api.get<GetVendorsResponse>('/api/vendors'),
  });

  // Fetch orders
  const { data: ordersData, isLoading: ordersLoading, refetch } = useQuery({
    queryKey: ['orders'],
    queryFn: () => api.get<GetOrdersResponse>('/api/orders'),
  });

  // Fetch below-par items when vendor is selected
  const { data: belowParData, isLoading: belowParLoading } = useQuery({
    queryKey: ['below-par', selectedVendor?.id],
    queryFn: () => api.get<GetBelowParItemsResponse>(`/api/orders/below-par/${selectedVendor?.id}`),
    enabled: !!selectedVendor,
  });

  // Auto-add below-par items when vendor is selected
  useEffect(() => {
    if (belowParData?.items && selectedVendor) {
      const itemsToAdd: OrderItemInput[] = belowParData.items.map((item) => ({
        inventoryItemId: item.inventoryItem.id,
        inventoryItem: item.inventoryItem,
        quantity: item.orderQty,
        unitCost: item.vendorProduct?.unitCost ?? undefined,
      }));
      setOrderItems(itemsToAdd);
    }
  }, [belowParData, selectedVendor]);

  const vendors = vendorsData?.vendors ?? [];
  const orders = ordersData?.orders ?? [];

  // Create vendor mutation
  const createVendorMutation = useMutation({
    mutationFn: (data: { name: string; email?: string; phone?: string }) =>
      api.post<Vendor>('/api/vendors', data),
    onSuccess: (vendor) => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      setSelectedVendor(vendor);
      setShowAddVendorModal(false);
      setNewVendorName('');
      setNewVendorEmail('');
      setNewVendorPhone('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: (data: CreateOrderRequest) =>
      api.post<Order>('/api/orders', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setShowCreateOrder(false);
      setSelectedVendor(null);
      setOrderItems([]);
      setOrderNotes('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  // Submit order mutation
  const submitOrderMutation = useMutation({
    mutationFn: (orderId: string) =>
      api.post<Order>(`/api/orders/${orderId}/submit`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  // Receive order mutation
  const receiveOrderMutation = useMutation({
    mutationFn: (orderId: string) =>
      api.post<Order>(`/api/orders/${orderId}/receive`, { updateInventory: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const handleCreateOrder = () => {
    if (!selectedVendor || orderItems.length === 0) return;

    createOrderMutation.mutate({
      vendorId: selectedVendor.id,
      notes: orderNotes || undefined,
      items: orderItems.map((item) => ({
        inventoryItemId: item.inventoryItemId,
        quantity: item.quantity,
        unitCost: item.unitCost,
      })),
    });
  };

  const updateItemQuantity = (index: number, delta: number) => {
    setOrderItems((prev) => {
      const newItems = [...prev];
      newItems[index].quantity = Math.max(1, newItems[index].quantity + delta);
      return newItems;
    });
  };

  const removeItem = (index: number) => {
    setOrderItems((prev) => prev.filter((_, i) => i !== index));
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

  const isLoading = vendorsLoading || ordersLoading;

  return (
    <View className="flex-1 bg-black">
      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <View className="px-5 pt-4 pb-3">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-white text-2xl font-bold">Orders</Text>
              <Text className="text-slate-400 text-sm mt-0.5">
                Create and manage vendor orders
              </Text>
            </View>
            <Pressable
              className="w-12 h-12 rounded-2xl items-center justify-center active:opacity-80"
              style={{ backgroundColor: accentColor }}
              onPress={() => setShowCreateOrder(true)}
            >
              <Plus size={24} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={accentColor} />
          </View>
        ) : (
          <ScrollView
            className="flex-1 px-5"
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={false} onRefresh={() => refetch()} tintColor={accentColor} />
            }
          >
            {/* Orders List */}
            {orders.length === 0 ? (
              <View className="items-center justify-center py-20">
                <View
                  className="w-20 h-20 rounded-full items-center justify-center mb-4"
                  style={{ backgroundColor: `${accentColor}20` }}
                >
                  <ShoppingCart size={36} color={accentColor} />
                </View>
                <Text className="text-white text-lg font-semibold mb-2">No Orders Yet</Text>
                <Text className="text-slate-400 text-center mb-6 px-8">
                  Create your first order to track purchases from vendors
                </Text>
                <Pressable
                  className="px-6 py-3 rounded-xl active:opacity-80"
                  style={{ backgroundColor: accentColor }}
                  onPress={() => setShowCreateOrder(true)}
                >
                  <Text className="text-white font-semibold">Create Order</Text>
                </Pressable>
              </View>
            ) : (
              <View className="pb-6">
                {orders.map((order, index) => (
                  <Animated.View
                    key={order.id}
                    entering={FadeInDown.delay(index * 50).springify()}
                  >
                    <Pressable
                      className="bg-slate-800/60 rounded-2xl p-4 mb-3 border border-slate-700/50 active:opacity-90"
                      onPress={() => router.push(`/order/${order.id}`)}
                    >
                      <View className="flex-row items-center justify-between mb-3">
                        <View className="flex-row items-center gap-3">
                          <View
                            className="w-10 h-10 rounded-full items-center justify-center"
                            style={{ backgroundColor: `${accentColor}20` }}
                          >
                            <Store size={20} color={accentColor} />
                          </View>
                          <View>
                            <Text className="text-white font-semibold">{order.vendor?.name}</Text>
                            <Text className="text-slate-400 text-xs">{order.orderNumber}</Text>
                          </View>
                        </View>
                        <View
                          className="px-3 py-1 rounded-full"
                          style={{ backgroundColor: `${getStatusColor(order.status)}20` }}
                        >
                          <Text
                            className="text-xs font-medium"
                            style={{ color: getStatusColor(order.status) }}
                          >
                            {getStatusLabel(order.status)}
                          </Text>
                        </View>
                      </View>

                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center gap-4">
                          <View className="flex-row items-center gap-1">
                            <Package size={14} color="#64748B" />
                            <Text className="text-slate-400 text-sm">
                              {order.items?.length ?? 0} items
                            </Text>
                          </View>
                          {order.totalAmount && (
                            <Text className="text-emerald-400 font-semibold">
                              ${order.totalAmount.toFixed(2)}
                            </Text>
                          )}
                        </View>
                        <View className="flex-row items-center gap-2">
                          {order.status === 'draft' && (
                            <Pressable
                              className="px-3 py-1.5 rounded-lg active:opacity-80"
                              style={{ backgroundColor: accentColor }}
                              onPress={(e) => {
                                e.stopPropagation();
                                submitOrderMutation.mutate(order.id);
                              }}
                            >
                              <View className="flex-row items-center gap-1">
                                <Send size={12} color="#FFFFFF" />
                                <Text className="text-white text-xs font-medium">Submit</Text>
                              </View>
                            </Pressable>
                          )}
                          {order.status === 'submitted' && (
                            <Pressable
                              className="px-3 py-1.5 rounded-lg bg-emerald-500 active:opacity-80"
                              onPress={(e) => {
                                e.stopPropagation();
                                receiveOrderMutation.mutate(order.id);
                              }}
                            >
                              <View className="flex-row items-center gap-1">
                                <PackageCheck size={12} color="#FFFFFF" />
                                <Text className="text-white text-xs font-medium">Receive</Text>
                              </View>
                            </Pressable>
                          )}
                          <ChevronRight size={20} color="#64748B" />
                        </View>
                      </View>
                    </Pressable>
                  </Animated.View>
                ))}
              </View>
            )}
          </ScrollView>
        )}

        {/* Create Order Modal */}
        <Modal visible={showCreateOrder} animationType="slide" presentationStyle="pageSheet">
          <View className="flex-1 bg-slate-900">
            <SafeAreaView className="flex-1">
              {/* Modal Header */}
              <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
                <View className="flex-row items-center gap-3">
                  <Pressable
                    className="w-10 h-10 rounded-full bg-slate-800 items-center justify-center active:opacity-80"
                    onPress={() => {
                      setShowCreateOrder(false);
                      setSelectedVendor(null);
                      setOrderItems([]);
                      setOrderNotes('');
                    }}
                  >
                    <X size={20} color="#FFFFFF" />
                  </Pressable>
                  <Text className="text-white text-lg font-bold">Create Order</Text>
                </View>
                <Pressable
                  className="px-4 py-2 rounded-xl active:opacity-80"
                  style={{
                    backgroundColor: selectedVendor && orderItems.length > 0 ? accentColor : '#374151',
                  }}
                  onPress={handleCreateOrder}
                  disabled={!selectedVendor || orderItems.length === 0 || createOrderMutation.isPending}
                >
                  {createOrderMutation.isPending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text
                      className={`font-semibold ${
                        selectedVendor && orderItems.length > 0 ? 'text-white' : 'text-slate-500'
                      }`}
                    >
                      Create
                    </Text>
                  )}
                </Pressable>
              </View>

              <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
                {/* Vendor Selection */}
                <View className="mt-4 mb-4">
                  <Text className="text-white font-semibold mb-2">Select Vendor</Text>
                  <Pressable
                    className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/50 active:opacity-90"
                    onPress={() => setShowVendorModal(true)}
                  >
                    {selectedVendor ? (
                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center gap-3">
                          <View
                            className="w-10 h-10 rounded-full items-center justify-center"
                            style={{ backgroundColor: `${accentColor}20` }}
                          >
                            <Store size={20} color={accentColor} />
                          </View>
                          <View>
                            <Text className="text-white font-semibold">{selectedVendor.name}</Text>
                            {selectedVendor.email && (
                              <Text className="text-slate-400 text-xs">{selectedVendor.email}</Text>
                            )}
                          </View>
                        </View>
                        <ChevronRight size={20} color="#64748B" />
                      </View>
                    ) : (
                      <View className="flex-row items-center justify-between">
                        <Text className="text-slate-400">Choose a vendor</Text>
                        <ChevronRight size={20} color="#64748B" />
                      </View>
                    )}
                  </Pressable>
                </View>

                {/* Below Par Alert */}
                {selectedVendor && belowParLoading && (
                  <View className="bg-slate-800/60 rounded-xl p-4 mb-4 items-center">
                    <ActivityIndicator size="small" color={accentColor} />
                    <Text className="text-slate-400 text-sm mt-2">Checking inventory levels...</Text>
                  </View>
                )}

                {selectedVendor && !belowParLoading && belowParData?.items && belowParData.items.length > 0 && (
                  <View className="bg-amber-500/10 rounded-xl p-4 mb-4 border border-amber-500/30">
                    <View className="flex-row items-center gap-2 mb-2">
                      <AlertCircle size={18} color="#F59E0B" />
                      <Text className="text-amber-400 font-semibold">Below Par Items Added</Text>
                    </View>
                    <Text className="text-amber-300/80 text-sm">
                      {belowParData.items.length} items from this vendor are below par level and have been
                      added to your order.
                    </Text>
                  </View>
                )}

                {/* Order Items */}
                {selectedVendor && (
                  <View className="mb-4">
                    <Text className="text-white font-semibold mb-2">
                      Order Items ({orderItems.length})
                    </Text>
                    {orderItems.length === 0 ? (
                      <View className="bg-slate-800/60 rounded-xl p-6 items-center border border-slate-700/50">
                        <Package size={32} color="#64748B" />
                        <Text className="text-slate-400 mt-2">No items to order</Text>
                        <Text className="text-slate-500 text-xs text-center mt-1">
                          Link products to this vendor to see them here
                        </Text>
                      </View>
                    ) : (
                      orderItems.map((item, index) => (
                        <View
                          key={item.inventoryItemId}
                          className="bg-slate-800/60 rounded-xl p-3 mb-2 border border-slate-700/50"
                        >
                          <View className="flex-row items-center gap-3">
                            <Image
                              source={{ uri: getImageUrl(item.inventoryItem.imageUrl) }}
                              className="w-12 h-12 rounded-lg bg-slate-700"
                            />
                            <View className="flex-1">
                              <Text className="text-white font-medium" numberOfLines={1}>
                                {item.inventoryItem.name}
                              </Text>
                              <View className="flex-row items-center gap-2 mt-1">
                                <Text className="text-slate-400 text-xs">
                                  Current: {item.inventoryItem.quantity}
                                </Text>
                                <Text className="text-slate-500">•</Text>
                                <Text className="text-amber-400 text-xs">
                                  Par: {item.inventoryItem.parLevel ?? '—'}
                                </Text>
                              </View>
                            </View>
                            <View className="flex-row items-center gap-2">
                              <Pressable
                                className="w-8 h-8 rounded-lg bg-slate-700 items-center justify-center active:opacity-80"
                                onPress={() => updateItemQuantity(index, -1)}
                              >
                                <Minus size={16} color="#FFFFFF" />
                              </Pressable>
                              <Text className="text-white font-bold w-8 text-center">
                                {item.quantity}
                              </Text>
                              <Pressable
                                className="w-8 h-8 rounded-lg bg-slate-700 items-center justify-center active:opacity-80"
                                onPress={() => updateItemQuantity(index, 1)}
                              >
                                <Plus size={16} color="#FFFFFF" />
                              </Pressable>
                              <Pressable
                                className="w-8 h-8 rounded-lg bg-red-500/20 items-center justify-center active:opacity-80 ml-2"
                                onPress={() => removeItem(index)}
                              >
                                <Trash2 size={16} color="#EF4444" />
                              </Pressable>
                            </View>
                          </View>
                        </View>
                      ))
                    )}
                  </View>
                )}

                {/* Order Notes */}
                {selectedVendor && (
                  <View className="mb-6">
                    <Text className="text-white font-semibold mb-2">Notes (Optional)</Text>
                    <TextInput
                      className="bg-slate-800/60 rounded-xl px-4 py-3 text-white border border-slate-700/50"
                      placeholder="Add notes for this order..."
                      placeholderTextColor="#64748B"
                      value={orderNotes}
                      onChangeText={setOrderNotes}
                      multiline
                      numberOfLines={3}
                    />
                  </View>
                )}

                <View className="h-20" />
              </ScrollView>
            </SafeAreaView>
          </View>
        </Modal>

        {/* Vendor Selection Modal */}
        <Modal visible={showVendorModal} animationType="slide" presentationStyle="pageSheet">
          <View className="flex-1 bg-slate-900">
            <SafeAreaView className="flex-1">
              <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
                <Text className="text-white text-lg font-bold">Select Vendor</Text>
                <Pressable
                  className="w-10 h-10 rounded-full bg-slate-800 items-center justify-center active:opacity-80"
                  onPress={() => setShowVendorModal(false)}
                >
                  <X size={20} color="#FFFFFF" />
                </Pressable>
              </View>

              <ScrollView className="flex-1 px-5 pt-4">
                {/* Add New Vendor Button */}
                <Pressable
                  className="bg-slate-800/60 rounded-xl p-4 mb-3 border border-dashed border-slate-600 active:opacity-80"
                  onPress={() => {
                    setShowVendorModal(false);
                    setShowAddVendorModal(true);
                  }}
                >
                  <View className="flex-row items-center justify-center gap-2">
                    <Plus size={20} color={accentColor} />
                    <Text style={{ color: accentColor }} className="font-semibold">
                      Add New Vendor
                    </Text>
                  </View>
                </Pressable>

                {vendors.map((vendor) => (
                  <Pressable
                    key={vendor.id}
                    className={`bg-slate-800/60 rounded-xl p-4 mb-2 border active:opacity-90 ${
                      selectedVendor?.id === vendor.id ? 'border-2' : 'border-slate-700/50'
                    }`}
                    style={{
                      borderColor: selectedVendor?.id === vendor.id ? accentColor : undefined,
                    }}
                    onPress={() => {
                      setSelectedVendor(vendor);
                      setShowVendorModal(false);
                    }}
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center gap-3">
                        <View
                          className="w-10 h-10 rounded-full items-center justify-center"
                          style={{ backgroundColor: `${accentColor}20` }}
                        >
                          <Store size={20} color={accentColor} />
                        </View>
                        <View>
                          <Text className="text-white font-semibold">{vendor.name}</Text>
                          {vendor.email && (
                            <Text className="text-slate-400 text-xs">{vendor.email}</Text>
                          )}
                        </View>
                      </View>
                      {selectedVendor?.id === vendor.id && (
                        <Check size={20} color={accentColor} />
                      )}
                    </View>
                  </Pressable>
                ))}

                {vendors.length === 0 && (
                  <View className="items-center py-10">
                    <Store size={48} color="#64748B" />
                    <Text className="text-slate-400 mt-3">No vendors yet</Text>
                    <Text className="text-slate-500 text-sm">Add your first vendor to get started</Text>
                  </View>
                )}
              </ScrollView>
            </SafeAreaView>
          </View>
        </Modal>

        {/* Add Vendor Modal */}
        <Modal visible={showAddVendorModal} animationType="slide" presentationStyle="pageSheet">
          <View className="flex-1 bg-slate-900">
            <SafeAreaView className="flex-1">
              <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
                <View className="flex-row items-center gap-3">
                  <Pressable
                    className="w-10 h-10 rounded-full bg-slate-800 items-center justify-center active:opacity-80"
                    onPress={() => {
                      setShowAddVendorModal(false);
                      setShowVendorModal(true);
                    }}
                  >
                    <X size={20} color="#FFFFFF" />
                  </Pressable>
                  <Text className="text-white text-lg font-bold">Add Vendor</Text>
                </View>
                <Pressable
                  className="px-4 py-2 rounded-xl active:opacity-80"
                  style={{
                    backgroundColor: newVendorName.trim() ? accentColor : '#374151',
                  }}
                  onPress={() => {
                    if (newVendorName.trim()) {
                      createVendorMutation.mutate({
                        name: newVendorName.trim(),
                        email: newVendorEmail.trim() || undefined,
                        phone: newVendorPhone.trim() || undefined,
                      });
                    }
                  }}
                  disabled={!newVendorName.trim() || createVendorMutation.isPending}
                >
                  {createVendorMutation.isPending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text
                      className={`font-semibold ${newVendorName.trim() ? 'text-white' : 'text-slate-500'}`}
                    >
                      Save
                    </Text>
                  )}
                </Pressable>
              </View>

              <ScrollView className="flex-1 px-5 pt-4">
                <View className="mb-4">
                  <Text className="text-white font-semibold mb-2">Vendor Name *</Text>
                  <View className="flex-row items-center bg-slate-800/60 rounded-xl border border-slate-700/50">
                    <View className="pl-4 pr-2">
                      <Building2 size={18} color="#64748B" />
                    </View>
                    <TextInput
                      className="flex-1 py-3.5 pr-4 text-white"
                      placeholder="Enter vendor name"
                      placeholderTextColor="#64748B"
                      value={newVendorName}
                      onChangeText={setNewVendorName}
                      autoFocus
                    />
                  </View>
                </View>

                <View className="mb-4">
                  <Text className="text-white font-semibold mb-2">Email (Optional)</Text>
                  <View className="flex-row items-center bg-slate-800/60 rounded-xl border border-slate-700/50">
                    <View className="pl-4 pr-2">
                      <Mail size={18} color="#64748B" />
                    </View>
                    <TextInput
                      className="flex-1 py-3.5 pr-4 text-white"
                      placeholder="vendor@email.com"
                      placeholderTextColor="#64748B"
                      value={newVendorEmail}
                      onChangeText={setNewVendorEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                <View className="mb-4">
                  <Text className="text-white font-semibold mb-2">Phone (Optional)</Text>
                  <View className="flex-row items-center bg-slate-800/60 rounded-xl border border-slate-700/50">
                    <View className="pl-4 pr-2">
                      <Phone size={18} color="#64748B" />
                    </View>
                    <TextInput
                      className="flex-1 py-3.5 pr-4 text-white"
                      placeholder="(555) 555-5555"
                      placeholderTextColor="#64748B"
                      value={newVendorPhone}
                      onChangeText={setNewVendorPhone}
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>
              </ScrollView>
            </SafeAreaView>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}
