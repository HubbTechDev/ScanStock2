import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Image, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, Modal, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, MapPin, Tag, Calendar, Trash2, CheckCircle, Pencil, X, Check, Bell, Clock, AlertTriangle, Plus, ShoppingBag, UtensilsCrossed, Building2, Package, RotateCcw, DollarSign, Store, ChevronRight } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Notifications from 'expo-notifications';
import { api, BACKEND_URL } from '@/lib/api';
import { useIndustryStore, INDUSTRY_CONFIGS, type IndustryType } from '@/lib/industry-store';
import type { InventoryItem, UpdateInventoryItemRequest, Reminder, GetRemindersResponse, CreateReminderRequest, GetVendorsResponse, Vendor, GetVendorProductsResponse, VendorProduct } from '@/shared/contracts';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const INDUSTRY_ICONS = {
  retail: ShoppingBag,
  restaurant: UtensilsCrossed,
  hospitality: Building2,
} as const;

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function ItemDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const industry = useIndustryStore((s) => s.industry);
  const config = industry ? INDUSTRY_CONFIGS[industry] : null;
  const accentColor = config?.color ?? '#06B6D4';

  const [isEditing, setIsEditing] = useState(false);

  // Reminder state
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderDate, setReminderDate] = useState(new Date());
  const [showReminderDatePicker, setShowReminderDatePicker] = useState(false);
  const [showReminderTimePicker, setShowReminderTimePicker] = useState(false);
  const [reminderNote, setReminderNote] = useState('');

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editBinNumber, setEditBinNumber] = useState('');
  const [editRackNumber, setEditRackNumber] = useState('');
  const [editCost, setEditCost] = useState('');
  const [editParLevel, setEditParLevel] = useState('');

  // Vendor state
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [showAddVendorModal, setShowAddVendorModal] = useState(false);
  const [newVendorName, setNewVendorName] = useState('');
  const [currentVendorProduct, setCurrentVendorProduct] = useState<VendorProduct | null>(null);

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: item, isLoading } = useQuery({
    queryKey: ['inventory', id],
    queryFn: () => api.get<InventoryItem>(`/api/inventory/${id}`),
    enabled: !!id,
  });

  // Fetch reminders for this item
  const { data: remindersData } = useQuery({
    queryKey: ['reminders', id],
    queryFn: () => api.get<GetRemindersResponse>(`/api/reminders/item/${id}`),
    enabled: !!id,
  });
  const reminders = remindersData?.reminders ?? [];

  // Fetch vendors
  const { data: vendorsData } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => api.get<GetVendorsResponse>('/api/vendors'),
  });
  const vendors = vendorsData?.vendors ?? [];

  // Find the vendor linked to this item
  useEffect(() => {
    const findItemVendor = async () => {
      if (!id || vendors.length === 0) return;

      for (const vendor of vendors) {
        try {
          const response = await api.get<GetVendorProductsResponse>(`/api/vendors/${vendor.id}/products`);
          const linkedProduct = response.products?.find(p => p.inventoryItemId === id);
          if (linkedProduct) {
            setSelectedVendor(vendor);
            setCurrentVendorProduct(linkedProduct);
            break;
          }
        } catch (error) {
          // Vendor might not have products, continue
        }
      }
    };
    findItemVendor();
  }, [id, vendors]);

  // Create vendor mutation
  const createVendorMutation = useMutation({
    mutationFn: (data: { name: string }) => api.post<Vendor>('/api/vendors', data),
    onSuccess: (vendor) => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      setSelectedVendor(vendor);
      setShowAddVendorModal(false);
      setNewVendorName('');
    },
  });

  // Link vendor to item mutation
  const linkVendorMutation = useMutation({
    mutationFn: async ({ vendorId, itemId }: { vendorId: string; itemId: string }) => {
      // First unlink from current vendor if exists
      if (currentVendorProduct) {
        await api.delete(`/api/vendors/${currentVendorProduct.vendorId}/products/${currentVendorProduct.id}`);
      }
      // Link to new vendor
      return api.post(`/api/vendors/${vendorId}/products`, {
        inventoryItemId: itemId,
        unitCost: item?.cost ?? undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      setShowVendorModal(false);
    },
  });

  // Unlink vendor mutation
  const unlinkVendorMutation = useMutation({
    mutationFn: async () => {
      if (currentVendorProduct) {
        await api.delete(`/api/vendors/${currentVendorProduct.vendorId}/products/${currentVendorProduct.id}`);
      }
    },
    onSuccess: () => {
      setSelectedVendor(null);
      setCurrentVendorProduct(null);
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      setShowVendorModal(false);
    },
  });

  // Initialize edit form when item loads
  useEffect(() => {
    if (item) {
      setEditName(item.name);
      setEditDescription(item.description ?? '');
      setEditBinNumber(item.binNumber ?? '');
      setEditRackNumber(item.rackNumber ?? '');
      setEditCost(item.cost?.toString() ?? '');
      setEditParLevel(item.parLevel?.toString() ?? '');
    }
  }, [item]);

  // Request notification permissions
  useEffect(() => {
    const requestPermissions = async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('Notification permissions not granted');
      }
    };
    requestPermissions();
  }, []);

  const updateMutation = useMutation({
    mutationFn: (data: UpdateInventoryItemRequest) =>
      api.patch<InventoryItem>(`/api/inventory/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', id] });
      setIsEditing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/api/inventory/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      router.back();
    },
  });

  // Reminder mutations
  const createReminderMutation = useMutation({
    mutationFn: (data: CreateReminderRequest) => api.post<Reminder>('/api/reminders', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders', id] });
      setShowReminderModal(false);
      setReminderNote('');
    },
  });

  const deleteReminderMutation = useMutation({
    mutationFn: (reminderId: string) => api.delete(`/api/reminders/${reminderId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders', id] });
    },
  });

  const getImageUrl = (imageUrl: string) => {
    if (imageUrl.startsWith('http')) return imageUrl;
    return `${BACKEND_URL}${imageUrl}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return accentColor;
      case 'completed': return '#10B981';
      default: return '#64748B';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (industry) {
      case 'retail':
        return status === 'pending' ? 'In Stock' : status === 'completed' ? 'Sold' : status;
      case 'restaurant':
        return status === 'pending' ? 'Available' : status === 'completed' ? 'Used' : status;
      case 'hospitality':
        return status === 'pending' ? 'Available' : status === 'completed' ? 'In Use' : status;
      default:
        return status === 'pending' ? 'Active' : status === 'completed' ? 'Completed' : status;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateShort = (date: Date) => {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const handleMarkCompleted = () => {
    updateMutation.mutate({ status: 'completed' });
  };

  const handleMoveBackToActive = () => {
    updateMutation.mutate({ status: 'pending' });
  };

  const handleDeleteConfirm = () => {
    setShowDeleteConfirm(false);
    deleteMutation.mutate();
  };

  const handleSaveEdit = () => {
    updateMutation.mutate({
      name: editName,
      description: editDescription || undefined,
      binNumber: editBinNumber || undefined,
      rackNumber: editRackNumber || undefined,
      cost: editCost ? parseFloat(editCost) : undefined,
      parLevel: editParLevel ? parseInt(editParLevel, 10) : null,
    });
  };

  const handleCancelEdit = () => {
    if (item) {
      setEditName(item.name);
      setEditDescription(item.description ?? '');
      setEditBinNumber(item.binNumber ?? '');
      setEditRackNumber(item.rackNumber ?? '');
      setEditCost(item.cost?.toString() ?? '');
      setEditParLevel(item.parLevel?.toString() ?? '');
    }
    setIsEditing(false);
  };

  const handleSetReminder = () => {
    const defaultReminder = new Date();
    defaultReminder.setDate(defaultReminder.getDate() + 1);
    defaultReminder.setHours(9, 0, 0, 0);
    setReminderDate(defaultReminder);
    setReminderNote('');
    setShowReminderModal(true);
  };

  const handleReminderDateChange = (_event: unknown, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowReminderDatePicker(false);
    }
    if (date) {
      const newDate = new Date(reminderDate);
      newDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
      setReminderDate(newDate);
    }
  };

  const handleReminderTimeChange = (_event: unknown, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowReminderTimePicker(false);
    }
    if (date) {
      const newDate = new Date(reminderDate);
      newDate.setHours(date.getHours(), date.getMinutes(), 0, 0);
      setReminderDate(newDate);
    }
  };

  const handleConfirmReminder = async () => {
    if (!item || !id) return;

    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Inventory Reminder',
          body: reminderNote || `Reminder for: ${item.name}`,
          data: { itemId: item.id },
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: reminderDate,
        },
      });

      createReminderMutation.mutate({
        itemId: id,
        reminderDate: reminderDate.toISOString(),
        note: reminderNote || undefined,
        notificationId,
      });
    } catch (error) {
      console.error('Error scheduling notification:', error);
      createReminderMutation.mutate({
        itemId: id,
        reminderDate: reminderDate.toISOString(),
        note: reminderNote || undefined,
      });
    }
  };

  const handleDeleteReminder = async (reminder: Reminder) => {
    if (reminder.notificationId) {
      try {
        await Notifications.cancelScheduledNotificationAsync(reminder.notificationId);
      } catch (error) {
        console.error('Error cancelling notification:', error);
      }
    }
    deleteReminderMutation.mutate(reminder.id);
  };

  const IndustryIcon = industry ? INDUSTRY_ICONS[industry] : Package;

  // Get location labels based on industry
  const getLocationLabel1 = () => {
    switch (industry) {
      case 'retail': return 'Aisle';
      case 'restaurant': return 'Storage';
      case 'hospitality': return 'Room';
      default: return 'Bin';
    }
  };

  const getLocationLabel2 = () => {
    switch (industry) {
      case 'retail': return 'Shelf';
      case 'restaurant': return 'Section';
      case 'hospitality': return 'Floor';
      default: return 'Rack';
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-neutral-900 items-center justify-center">
        <ActivityIndicator size="large" color={accentColor} />
      </View>
    );
  }

  if (!item) {
    return (
      <View className="flex-1 bg-neutral-900 items-center justify-center">
        <Text className="text-white">Item not found</Text>
        <Pressable
          className="rounded-xl px-6 py-3 mt-4"
          style={{ backgroundColor: accentColor }}
          onPress={() => router.back()}
        >
          <Text className="text-white font-bold">Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-neutral-900">
      <LinearGradient
        colors={['#1C1C1E', '#2C2C2E', '#1C1C1E']}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />
      <SafeAreaView className="flex-1" edges={['top']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          {/* Header */}
          <View className="px-5 pt-4 pb-4 flex-row items-center justify-between">
            <Pressable
              className="w-10 h-10 rounded-full bg-slate-800 items-center justify-center active:opacity-80"
              onPress={() => isEditing ? handleCancelEdit() : router.back()}
            >
              {isEditing ? (
                <X size={20} color="#F8FAFC" />
              ) : (
                <ArrowLeft size={20} color="#F8FAFC" />
              )}
            </Pressable>
            <View className="flex-row items-center gap-2">
              <IndustryIcon size={16} color={accentColor} />
              <Text className="text-white text-lg font-bold">
                {isEditing ? 'Edit Item' : 'Item Details'}
              </Text>
            </View>
            {isEditing ? (
              <Pressable
                className="w-10 h-10 rounded-full items-center justify-center active:opacity-80"
                style={{ backgroundColor: accentColor }}
                onPress={handleSaveEdit}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Check size={20} color="#FFFFFF" />
                )}
              </Pressable>
            ) : (
              <View className="flex-row gap-2">
                <Pressable
                  className="w-10 h-10 rounded-full bg-slate-800 items-center justify-center active:opacity-80"
                  onPress={() => setIsEditing(true)}
                >
                  <Pencil size={18} color={accentColor} />
                </Pressable>
                <Pressable
                  className="w-10 h-10 rounded-full bg-red-500/20 items-center justify-center active:opacity-80"
                  onPress={() => setShowDeleteConfirm(true)}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? (
                    <ActivityIndicator size="small" color="#EF4444" />
                  ) : (
                    <Trash2 size={18} color="#EF4444" />
                  )}
                </Pressable>
              </View>
            )}
          </View>

          <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
            {/* Item Image */}
            <View className="px-5 mb-6">
              <Image
                source={{ uri: getImageUrl(item.imageUrl) }}
                className="w-full h-72 rounded-2xl bg-slate-700"
                resizeMode="cover"
              />
              <View
                className="absolute bottom-4 left-9 px-4 py-2 rounded-full"
                style={{ backgroundColor: getStatusColor(item.status) }}
              >
                <Text className="text-white text-sm font-bold">{getStatusLabel(item.status)}</Text>
              </View>
            </View>

            {/* Item Info */}
            <View className="px-5">
              {isEditing ? (
                // Edit Mode
                <>
                  <View className="mb-4">
                    <Text className="text-slate-400 text-xs mb-2">Item Name *</Text>
                    <TextInput
                      className="bg-slate-800/60 rounded-xl px-4 py-3 text-white border border-slate-700/50"
                      value={editName}
                      onChangeText={setEditName}
                      placeholder="Enter item name"
                      placeholderTextColor="#64748B"
                    />
                  </View>

                  <View className="mb-4">
                    <Text className="text-slate-400 text-xs mb-2">Description</Text>
                    <TextInput
                      className="bg-slate-800/60 rounded-xl px-4 py-3 text-white border border-slate-700/50"
                      value={editDescription}
                      onChangeText={setEditDescription}
                      placeholder="Optional description"
                      placeholderTextColor="#64748B"
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                    />
                  </View>

                  <View className="flex-row gap-3 mb-4">
                    <View className="flex-1">
                      <Text className="text-slate-400 text-xs mb-2">{getLocationLabel1()}</Text>
                      <TextInput
                        className="bg-slate-800/60 rounded-xl px-4 py-3 text-white border border-slate-700/50"
                        value={editBinNumber}
                        onChangeText={setEditBinNumber}
                        placeholder="e.g., A1"
                        placeholderTextColor="#64748B"
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-slate-400 text-xs mb-2">{getLocationLabel2()}</Text>
                      <TextInput
                        className="bg-slate-800/60 rounded-xl px-4 py-3 text-white border border-slate-700/50"
                        value={editRackNumber}
                        onChangeText={setEditRackNumber}
                        placeholder="e.g., R01"
                        placeholderTextColor="#64748B"
                      />
                    </View>
                  </View>

                  <View className="mb-4">
                    <Text className="text-slate-400 text-xs mb-2">Cost</Text>
                    <View className="flex-row items-center bg-slate-800/60 rounded-xl border border-slate-700/50">
                      <View className="pl-4 pr-2">
                        <DollarSign size={18} color="#64748B" />
                      </View>
                      <TextInput
                        className="flex-1 py-3 pr-4 text-white"
                        value={editCost}
                        onChangeText={setEditCost}
                        placeholder="0.00"
                        placeholderTextColor="#64748B"
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <Text className="text-slate-500 text-xs mt-1.5">Purchase/acquisition cost for COGS tracking</Text>
                  </View>

                  <View className="mb-4">
                    <Text className="text-slate-400 text-xs mb-2">Par Level</Text>
                    <View className="flex-row items-center bg-slate-800/60 rounded-xl border border-slate-700/50">
                      <View className="pl-4 pr-2">
                        <Package size={18} color="#64748B" />
                      </View>
                      <TextInput
                        className="flex-1 py-3 pr-4 text-white"
                        value={editParLevel}
                        onChangeText={setEditParLevel}
                        placeholder="0"
                        placeholderTextColor="#64748B"
                        keyboardType="number-pad"
                      />
                    </View>
                    <Text className="text-slate-500 text-xs mt-1.5">Minimum quantity to maintain in stock</Text>
                  </View>

                  <View className="mb-4">
                    <Text className="text-slate-400 text-xs mb-2">Vendor</Text>
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
                            <Text className="text-white font-medium">{selectedVendor.name}</Text>
                          </View>
                          <ChevronRight size={20} color="#64748B" />
                        </View>
                      ) : (
                        <View className="flex-row items-center justify-between">
                          <View className="flex-row items-center gap-3">
                            <View className="w-10 h-10 rounded-full bg-slate-700 items-center justify-center">
                              <Store size={20} color="#64748B" />
                            </View>
                            <Text className="text-slate-400">Select a vendor</Text>
                          </View>
                          <ChevronRight size={20} color="#64748B" />
                        </View>
                      )}
                    </Pressable>
                    <Text className="text-slate-500 text-xs mt-1.5">Link this item to a vendor for ordering</Text>
                  </View>
                </>
              ) : (
                // View Mode
                <>
                  <Text className="text-white text-2xl font-bold mb-2">{item.name}</Text>
                  {item.description && (
                    <Text className="text-slate-400 text-base mb-4">{item.description}</Text>
                  )}

                  {/* Location Card */}
                  <View className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/50 mb-4">
                    <View className="flex-row items-center mb-3">
                      <MapPin size={18} color={accentColor} />
                      <Text className="text-slate-400 text-sm ml-2">Location</Text>
                    </View>
                    <View className="flex-row gap-3">
                      <View className="bg-slate-700/50 px-4 py-3 rounded-xl flex-1">
                        <Text className="text-slate-400 text-xs">{getLocationLabel1()}</Text>
                        <Text className="text-white font-bold text-xl">{item.binNumber || '—'}</Text>
                      </View>
                      <View className="bg-slate-700/50 px-4 py-3 rounded-xl flex-1">
                        <Text className="text-slate-400 text-xs">{getLocationLabel2()}</Text>
                        <Text className="text-white font-bold text-xl">{item.rackNumber || '—'}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Category/Platform Card */}
                  {item.platform && (
                    <View className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/50 mb-4">
                      <View className="flex-row items-center mb-2">
                        <Tag size={18} color={accentColor} />
                        <Text className="text-slate-400 text-sm ml-2">
                          {industry === 'retail' ? 'Category' : industry === 'restaurant' ? 'Type' : 'Area'}
                        </Text>
                      </View>
                      <Text className="font-bold text-lg" style={{ color: accentColor }}>{item.platform}</Text>
                    </View>
                  )}

                  {/* Dates Card */}
                  <View className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/50 mb-4">
                    <View className="flex-row items-center mb-3">
                      <Calendar size={18} color={accentColor} />
                      <Text className="text-slate-400 text-sm ml-2">Timeline</Text>
                    </View>
                    <View className="flex-row justify-between">
                      <View>
                        <Text className="text-slate-500 text-xs">Added</Text>
                        <Text className="text-white text-sm">{formatDate(item.createdAt)}</Text>
                      </View>
                      <View>
                        <Text className="text-slate-500 text-xs">Updated</Text>
                        <Text className="text-white text-sm">{formatDate(item.updatedAt)}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Cost Card */}
                  {item.cost !== null && item.cost !== undefined && (
                    <View className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/50 mb-4">
                      <View className="flex-row items-center mb-2">
                        <DollarSign size={18} color="#10B981" />
                        <Text className="text-slate-400 text-sm ml-2">Cost</Text>
                      </View>
                      <Text className="text-emerald-400 font-bold text-2xl">${item.cost.toFixed(2)}</Text>
                      <Text className="text-slate-500 text-xs mt-1">Purchase/acquisition cost</Text>
                    </View>
                  )}

                  {/* Par Level and Quantity Card */}
                  <View className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/50 mb-4">
                    <View className="flex-row items-center mb-3">
                      <Package size={18} color={accentColor} />
                      <Text className="text-slate-400 text-sm ml-2">Stock Levels</Text>
                    </View>
                    <View className="flex-row gap-3">
                      <View className="bg-slate-700/50 px-4 py-3 rounded-xl flex-1">
                        <Text className="text-slate-400 text-xs">Current Qty</Text>
                        <Text className="text-white font-bold text-xl">{item.quantity}</Text>
                      </View>
                      <View className="bg-slate-700/50 px-4 py-3 rounded-xl flex-1">
                        <Text className="text-slate-400 text-xs">Par Level</Text>
                        <Text className={`font-bold text-xl ${
                          item.parLevel !== null && item.quantity < item.parLevel
                            ? 'text-amber-400'
                            : 'text-white'
                        }`}>
                          {item.parLevel ?? '—'}
                        </Text>
                      </View>
                    </View>
                    {item.parLevel !== null && item.quantity < item.parLevel && (
                      <View className="bg-amber-500/20 rounded-xl p-3 mt-3 flex-row items-center">
                        <AlertTriangle size={16} color="#F59E0B" />
                        <Text className="text-amber-400 text-sm ml-2">
                          Below par level by {item.parLevel - item.quantity}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Vendor Card */}
                  {selectedVendor && (
                    <View className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/50 mb-4">
                      <View className="flex-row items-center mb-3">
                        <Store size={18} color={accentColor} />
                        <Text className="text-slate-400 text-sm ml-2">Vendor</Text>
                      </View>
                      <View className="flex-row items-center gap-3">
                        <View
                          className="w-12 h-12 rounded-full items-center justify-center"
                          style={{ backgroundColor: `${accentColor}20` }}
                        >
                          <Store size={24} color={accentColor} />
                        </View>
                        <View>
                          <Text className="text-white font-semibold text-lg">{selectedVendor.name}</Text>
                          {selectedVendor.email && (
                            <Text className="text-slate-400 text-sm">{selectedVendor.email}</Text>
                          )}
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Active Reminders */}
                  {reminders.length > 0 && (
                    <View className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/50 mb-4">
                      <View className="flex-row items-center mb-3">
                        <Bell size={18} color="#F59E0B" />
                        <Text className="text-white font-semibold ml-2">Reminders</Text>
                      </View>
                      {reminders.map((reminder) => {
                        const reminderTime = new Date(reminder.reminderDate);
                        const isPast = reminderTime < new Date();
                        return (
                          <View
                            key={reminder.id}
                            className={`flex-row items-center justify-between py-3 border-b border-slate-700/50 last:border-b-0 ${isPast ? 'opacity-60' : ''}`}
                          >
                            <View className="flex-1">
                              <Text className={`font-medium ${isPast ? 'text-slate-400' : 'text-white'}`}>
                                {formatDateShort(reminderTime)} at {formatTime(reminderTime)}
                              </Text>
                              {reminder.note && (
                                <Text className="text-slate-400 text-sm mt-1" numberOfLines={1}>
                                  {reminder.note}
                                </Text>
                              )}
                              {isPast && (
                                <Text className="text-amber-500 text-xs mt-1">Past due</Text>
                              )}
                            </View>
                            <Pressable
                              className="w-8 h-8 rounded-lg bg-red-500/20 items-center justify-center ml-3"
                              onPress={() => handleDeleteReminder(reminder)}
                              disabled={deleteReminderMutation.isPending}
                            >
                              {deleteReminderMutation.isPending ? (
                                <ActivityIndicator size="small" color="#EF4444" />
                              ) : (
                                <Trash2 size={14} color="#EF4444" />
                              )}
                            </Pressable>
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {/* Action Buttons based on status */}
                  {item.status === 'pending' && (
                    <View className="mb-6">
                      <Pressable
                        className="rounded-2xl py-4 flex-row items-center justify-center active:opacity-80"
                        style={{ backgroundColor: accentColor }}
                        onPress={handleMarkCompleted}
                        disabled={updateMutation.isPending}
                      >
                        {updateMutation.isPending ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <CheckCircle size={20} color="#FFFFFF" />
                            <Text className="text-white font-bold text-base ml-2">
                              {industry === 'retail' ? 'Mark as Sold' : industry === 'restaurant' ? 'Mark as Used' : 'Mark Complete'}
                            </Text>
                          </>
                        )}
                      </Pressable>

                      <Pressable
                        className="bg-amber-500/20 rounded-2xl py-4 flex-row items-center justify-center active:opacity-80 mt-3 border border-amber-500/50"
                        onPress={handleSetReminder}
                      >
                        <Plus size={20} color="#F59E0B" />
                        <Text className="text-amber-400 font-bold text-base ml-2">Add Reminder</Text>
                      </Pressable>
                    </View>
                  )}

                  {item.status === 'completed' && (
                    <View className="mb-6">
                      <View className="bg-emerald-500/20 rounded-2xl p-4 border border-emerald-500/50 mb-3">
                        <View className="flex-row items-center justify-center">
                          <CheckCircle size={20} color="#10B981" />
                          <Text className="text-emerald-400 font-bold text-base ml-2">
                            {industry === 'retail' ? 'Sold' : industry === 'restaurant' ? 'Used' : 'Completed'}
                          </Text>
                        </View>
                      </View>
                      <Pressable
                        className="rounded-2xl py-4 flex-row items-center justify-center active:opacity-80 border"
                        style={{ backgroundColor: `${accentColor}20`, borderColor: `${accentColor}50` }}
                        onPress={handleMoveBackToActive}
                        disabled={updateMutation.isPending}
                      >
                        {updateMutation.isPending ? (
                          <ActivityIndicator size="small" color={accentColor} />
                        ) : (
                          <>
                            <RotateCcw size={20} color={accentColor} />
                            <Text className="font-bold text-base ml-2" style={{ color: accentColor }}>Move Back to Active</Text>
                          </>
                        )}
                      </Pressable>
                    </View>
                  )}
                </>
              )}
            </View>

            <View className="h-8" />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Reminder Modal */}
      <Modal
        visible={showReminderModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReminderModal(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-slate-900 rounded-t-3xl p-5">
            <View className="flex-row items-center justify-between mb-4">
              <Pressable
                className="w-10 h-10 rounded-full bg-slate-800 items-center justify-center"
                onPress={() => setShowReminderModal(false)}
              >
                <X size={20} color="#F8FAFC" />
              </Pressable>
              <Text className="text-white text-lg font-bold">Set Reminder</Text>
              <Pressable
                className="w-10 h-10 rounded-full bg-amber-500 items-center justify-center"
                onPress={handleConfirmReminder}
                disabled={createReminderMutation.isPending}
              >
                {createReminderMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Check size={20} color="#FFFFFF" />
                )}
              </Pressable>
            </View>

            <View className="bg-slate-800/60 rounded-xl p-3 mb-4 flex-row items-center">
              <Image
                source={{ uri: getImageUrl(item.imageUrl) }}
                className="w-12 h-12 rounded-lg bg-slate-700"
              />
              <Text className="text-white font-semibold ml-3 flex-1" numberOfLines={1}>
                {item.name}
              </Text>
            </View>

            {/* Date Selection */}
            <View className="mb-4">
              <View className="flex-row items-center mb-2">
                <Calendar size={16} color="#F59E0B" />
                <Text className="text-white font-semibold ml-2">Reminder Date</Text>
              </View>
              <Pressable
                className="bg-slate-800 rounded-xl px-4 py-3"
                onPress={() => setShowReminderDatePicker(true)}
              >
                <Text className="text-white text-base">{formatDateShort(reminderDate)}</Text>
              </Pressable>
            </View>

            {showReminderDatePicker && (
              <View className="bg-slate-800 rounded-xl mb-4 overflow-hidden">
                <DateTimePicker
                  value={reminderDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleReminderDateChange}
                  minimumDate={new Date()}
                  textColor="#FFFFFF"
                  themeVariant="dark"
                />
                {Platform.OS === 'ios' && (
                  <Pressable
                    className="py-2 items-center"
                    style={{ backgroundColor: accentColor }}
                    onPress={() => setShowReminderDatePicker(false)}
                  >
                    <Text className="text-white font-semibold">Done</Text>
                  </Pressable>
                )}
              </View>
            )}

            {/* Time Selection */}
            <View className="mb-4">
              <View className="flex-row items-center mb-2">
                <Clock size={16} color="#F59E0B" />
                <Text className="text-white font-semibold ml-2">Reminder Time</Text>
              </View>
              <Pressable
                className="bg-slate-800 rounded-xl px-4 py-3"
                onPress={() => setShowReminderTimePicker(true)}
              >
                <Text className="text-white text-base">{formatTime(reminderDate)}</Text>
              </Pressable>
            </View>

            {showReminderTimePicker && (
              <View className="bg-slate-800 rounded-xl mb-4 overflow-hidden">
                <DateTimePicker
                  value={reminderDate}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleReminderTimeChange}
                  textColor="#FFFFFF"
                  themeVariant="dark"
                />
                {Platform.OS === 'ios' && (
                  <Pressable
                    className="py-2 items-center"
                    style={{ backgroundColor: accentColor }}
                    onPress={() => setShowReminderTimePicker(false)}
                  >
                    <Text className="text-white font-semibold">Done</Text>
                  </Pressable>
                )}
              </View>
            )}

            {/* Note Field */}
            <View className="mb-4">
              <View className="flex-row items-center mb-2">
                <Pencil size={16} color="#F59E0B" />
                <Text className="text-white font-semibold ml-2">Note (Optional)</Text>
              </View>
              <TextInput
                className="bg-slate-800 rounded-xl px-4 py-3 text-white"
                value={reminderNote}
                onChangeText={setReminderNote}
                placeholder="Add a note..."
                placeholderTextColor="#64748B"
                multiline
                numberOfLines={2}
              />
            </View>

            <View className="bg-amber-500/20 rounded-xl p-3 flex-row items-center">
              <Bell size={16} color="#F59E0B" />
              <Text className="text-amber-400 text-sm ml-2 flex-1">
                You'll receive a notification at {formatTime(reminderDate)} on {formatDateShort(reminderDate)}
              </Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteConfirm(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/60 px-6">
          <View className="bg-slate-900 rounded-2xl p-6 w-full max-w-sm border border-slate-700">
            <View className="items-center mb-4">
              <View className="bg-red-500/20 w-16 h-16 rounded-full items-center justify-center mb-4">
                <AlertTriangle size={32} color="#EF4444" />
              </View>
              <Text className="text-white text-xl font-bold text-center">Delete Item?</Text>
              <Text className="text-slate-400 text-center mt-2">
                Are you sure you want to delete "{item?.name ?? 'this item'}"? This action cannot be undone.
              </Text>
            </View>

            <View className="flex-row gap-3 mt-4">
              <Pressable
                className="flex-1 bg-slate-700 rounded-xl py-3 items-center active:opacity-80"
                onPress={() => setShowDeleteConfirm(false)}
              >
                <Text className="text-white font-semibold">Cancel</Text>
              </Pressable>
              <Pressable
                className="flex-1 bg-red-500 rounded-xl py-3 items-center active:opacity-80"
                onPress={handleDeleteConfirm}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-white font-semibold">Delete</Text>
                )}
              </Pressable>
            </View>
          </View>
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
              {/* Clear Selection */}
              {selectedVendor && (
                <Pressable
                  className="bg-slate-800/60 rounded-xl p-4 mb-3 border border-slate-700/50 active:opacity-80"
                  onPress={() => unlinkVendorMutation.mutate()}
                  disabled={unlinkVendorMutation.isPending}
                >
                  <View className="flex-row items-center justify-center gap-2">
                    {unlinkVendorMutation.isPending ? (
                      <ActivityIndicator size="small" color="#EF4444" />
                    ) : (
                      <>
                        <X size={18} color="#EF4444" />
                        <Text className="text-red-400 font-medium">Remove Vendor</Text>
                      </>
                    )}
                  </View>
                </Pressable>
              )}

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
                    if (id) {
                      linkVendorMutation.mutate({ vendorId: vendor.id, itemId: id });
                      setSelectedVendor(vendor);
                    }
                  }}
                  disabled={linkVendorMutation.isPending}
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
                    createVendorMutation.mutate({ name: newVendorName.trim() });
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

            <View className="px-5 pt-4">
              <Text className="text-white font-semibold mb-2">Vendor Name *</Text>
              <View className="flex-row items-center bg-slate-800/60 rounded-xl border border-slate-700/50">
                <View className="pl-4 pr-2">
                  <Store size={18} color="#64748B" />
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
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}
