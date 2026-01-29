import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Image, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Upload, X, Check, Image as ImageIcon, Settings, DollarSign, Hash, Package, Store, ChevronRight, Plus } from 'lucide-react-native';
import { api, BACKEND_URL } from '@/lib/api';
import { useStorageLocations } from '@/lib/storage-locations';
import { useIndustryStore, INDUSTRY_CONFIGS } from '@/lib/industry-store';
import type { CreateInventoryItemRequest, InventoryItem, UploadImageResponse, GetVendorsResponse, Vendor } from '@/shared/contracts';

export default function AddItemScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { locationFields, isLoaded, loadLocations } = useStorageLocations();
  const industry = useIndustryStore((s) => s.industry);
  const config = industry ? INDUSTRY_CONFIGS[industry] : null;
  const accentColor = config?.color ?? '#06B6D4';

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [parLevel, setParLevel] = useState('');
  const [cost, setCost] = useState('');
  const [locationValues, setLocationValues] = useState<Record<string, string>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [showAddVendorModal, setShowAddVendorModal] = useState(false);
  const [newVendorName, setNewVendorName] = useState('');

  // Fetch vendors
  const { data: vendorsData } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => api.get<GetVendorsResponse>('/api/vendors'),
  });
  const vendors = vendorsData?.vendors ?? [];

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

  useEffect(() => {
    loadLocations();
  }, []);

  const enabledFields = locationFields.filter((f) => f.enabled);

  const createMutation = useMutation({
    mutationFn: async (data: CreateInventoryItemRequest) => {
      const item = await api.post<InventoryItem>('/api/inventory', data);
      // If a vendor is selected, link the item to the vendor
      if (selectedVendor && item) {
        await api.post(`/api/vendors/${selectedVendor.id}/products`, {
          inventoryItemId: item.id,
          unitCost: cost ? parseFloat(cost) : undefined,
        });
      }
      return item;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      router.back();
    },
  });

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      uploadImage(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      uploadImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      const filename = uri.split('/').pop() ?? 'image.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      formData.append('image', {
        uri,
        name: filename,
        type,
      } as unknown as Blob);

      const response = await fetch(`${BACKEND_URL}/api/upload/image`, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const data: UploadImageResponse = await response.json();
      if (data.success) {
        setUploadedImageUrl(data.url);
      }
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = () => {
    if (!uploadedImageUrl || !name) {
      return;
    }

    // Map location values to bin/rack fields for backward compatibility
    const binField = enabledFields.find((f) => f.id === 'bin');
    const rackField = enabledFields.find((f) => f.id === 'rack');

    createMutation.mutate({
      name,
      description: description || undefined,
      imageUrl: uploadedImageUrl,
      binNumber: binField ? locationValues[binField.id] || undefined : locationValues[enabledFields[0]?.id] || undefined,
      rackNumber: rackField ? locationValues[rackField.id] || undefined : locationValues[enabledFields[1]?.id] || undefined,
      quantity: quantity ? parseInt(quantity, 10) : 1,
      parLevel: parLevel ? parseInt(parLevel, 10) : null,
      cost: cost ? parseFloat(cost) : undefined,
      status: 'pending',
    });
  };

  const isValid = uploadedImageUrl && name;

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
              onPress={() => router.back()}
            >
              <X size={20} color="#F8FAFC" />
            </Pressable>
            <Text className="text-white text-lg font-bold">Add Item</Text>
            <Pressable
              className={`w-10 h-10 rounded-full items-center justify-center ${
                isValid ? 'bg-cyan-500' : 'bg-slate-800'
              }`}
              onPress={handleSubmit}
              disabled={!isValid || createMutation.isPending}
            >
              {createMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Check size={20} color={isValid ? '#FFFFFF' : '#64748B'} />
              )}
            </Pressable>
          </View>

          <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
            {/* Image Upload Section */}
            <View className="mb-6">
              <Text className="text-white font-semibold mb-3">Item Photo *</Text>
              {!imageUri ? (
                <View className="bg-slate-800/60 rounded-2xl p-8 items-center border border-slate-700/50 border-dashed">
                  <View className="bg-cyan-500/20 w-16 h-16 rounded-full items-center justify-center mb-4">
                    <ImageIcon size={32} color="#06B6D4" />
                  </View>
                  <Text className="text-slate-400 text-sm text-center mb-4">
                    Take a photo or upload from gallery
                  </Text>
                  <View className="flex-row gap-3">
                    <Pressable
                      className="bg-cyan-500 rounded-xl px-5 py-2.5 flex-row items-center gap-2 active:opacity-80"
                      onPress={takePhoto}
                    >
                      <Camera size={18} color="#FFFFFF" />
                      <Text className="text-white font-semibold">Camera</Text>
                    </Pressable>
                    <Pressable
                      className="bg-slate-700 rounded-xl px-5 py-2.5 flex-row items-center gap-2 active:opacity-80"
                      onPress={pickImage}
                    >
                      <Upload size={18} color="#FFFFFF" />
                      <Text className="text-white font-semibold">Gallery</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/50">
                  <Image
                    source={{ uri: imageUri }}
                    className="w-full h-48 rounded-xl bg-slate-700"
                    resizeMode="cover"
                  />
                  {isUploading && (
                    <View className="absolute inset-0 bg-slate-900/80 rounded-2xl items-center justify-center">
                      <ActivityIndicator size="large" color="#06B6D4" />
                      <Text className="text-white mt-2">Uploading...</Text>
                    </View>
                  )}
                  {!isUploading && uploadedImageUrl && (
                    <View className="absolute top-6 right-6 bg-emerald-500 w-8 h-8 rounded-full items-center justify-center">
                      <Check size={16} color="#FFFFFF" />
                    </View>
                  )}
                  <Pressable
                    className="absolute top-6 left-6 bg-slate-900/80 px-3 py-1.5 rounded-full active:opacity-80"
                    onPress={() => {
                      setImageUri(null);
                      setUploadedImageUrl(null);
                    }}
                  >
                    <Text className="text-white text-xs font-medium">Change</Text>
                  </Pressable>
                </View>
              )}
            </View>

            {/* Item Name */}
            <View className="mb-4">
              <Text className="text-white font-semibold mb-2">Item Name *</Text>
              <TextInput
                className="bg-slate-800/60 rounded-xl px-4 py-3.5 text-white border border-slate-700/50"
                placeholder="Enter item name"
                placeholderTextColor="#64748B"
                value={name}
                onChangeText={setName}
              />
            </View>

            {/* Quantity */}
            <View className="mb-4">
              <Text className="text-white font-semibold mb-2">Quantity</Text>
              <View className="flex-row items-center bg-slate-800/60 rounded-xl border border-slate-700/50">
                <View className="pl-4 pr-2">
                  <Hash size={18} color="#64748B" />
                </View>
                <TextInput
                  className="flex-1 py-3.5 pr-4 text-white"
                  placeholder="1"
                  placeholderTextColor="#64748B"
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="number-pad"
                />
              </View>
              <Text className="text-slate-500 text-xs mt-1.5">How many of this item do you have?</Text>
            </View>

            {/* Description */}
            <View className="mb-4">
              <Text className="text-white font-semibold mb-2">Description</Text>
              <TextInput
                className="bg-slate-800/60 rounded-xl px-4 py-3.5 text-white border border-slate-700/50"
                placeholder="Optional description"
                placeholderTextColor="#64748B"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            {/* Cost */}
            <View className="mb-4">
              <Text className="text-white font-semibold mb-2">Cost (Optional)</Text>
              <View className="flex-row items-center bg-slate-800/60 rounded-xl border border-slate-700/50">
                <View className="pl-4 pr-2">
                  <DollarSign size={18} color="#64748B" />
                </View>
                <TextInput
                  className="flex-1 py-3.5 pr-4 text-white"
                  placeholder="0.00"
                  placeholderTextColor="#64748B"
                  value={cost}
                  onChangeText={setCost}
                  keyboardType="decimal-pad"
                />
              </View>
              <Text className="text-slate-500 text-xs mt-1.5">Enter the purchase/acquisition cost for COGS tracking</Text>
            </View>

            {/* Par Level */}
            <View className="mb-4">
              <Text className="text-white font-semibold mb-2">Par Level (Optional)</Text>
              <View className="flex-row items-center bg-slate-800/60 rounded-xl border border-slate-700/50">
                <View className="pl-4 pr-2">
                  <Package size={18} color="#64748B" />
                </View>
                <TextInput
                  className="flex-1 py-3.5 pr-4 text-white"
                  placeholder="0"
                  placeholderTextColor="#64748B"
                  value={parLevel}
                  onChangeText={setParLevel}
                  keyboardType="number-pad"
                />
              </View>
              <Text className="text-slate-500 text-xs mt-1.5">Minimum quantity to maintain in stock</Text>
            </View>

            {/* Vendor Selection */}
            <View className="mb-4">
              <Text className="text-white font-semibold mb-2">Vendor (Optional)</Text>
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

            {/* Location Fields */}
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-white font-semibold">Storage Location (Optional)</Text>
              <Pressable
                className="flex-row items-center gap-1 active:opacity-80"
                onPress={() => router.push('/storage-settings')}
              >
                <Settings size={14} color="#06B6D4" />
                <Text className="text-cyan-400 text-xs">Customize</Text>
              </Pressable>
            </View>
            {enabledFields.length > 0 ? (
              <View className="flex-row flex-wrap gap-3 mb-4">
                {enabledFields.map((field) => (
                  <View key={field.id} className="flex-1 min-w-[140px]">
                    <Text className="text-slate-400 text-xs mb-2">{field.name}</Text>
                    <TextInput
                      className="bg-slate-800/60 rounded-xl px-4 py-3.5 text-white border border-slate-700/50"
                      placeholder={field.placeholder}
                      placeholderTextColor="#64748B"
                      value={locationValues[field.id] ?? ''}
                      onChangeText={(text) =>
                        setLocationValues((prev) => ({ ...prev, [field.id]: text }))
                      }
                    />
                  </View>
                ))}
              </View>
            ) : (
              <Pressable
                className="bg-slate-800/40 rounded-xl p-4 mb-4 border border-dashed border-slate-600 items-center active:opacity-80"
                onPress={() => router.push('/storage-settings')}
              >
                <Text className="text-slate-400 text-sm">No location fields configured</Text>
                <Text className="text-cyan-400 text-xs mt-1">Tap to add location fields</Text>
              </Pressable>
            )}

            {/* Submit Button */}
            <Pressable
              className={`rounded-2xl py-4 items-center mb-8 ${
                isValid ? 'bg-cyan-500 active:opacity-80' : 'bg-slate-700'
              }`}
              style={isValid ? { backgroundColor: accentColor } : undefined}
              onPress={handleSubmit}
              disabled={!isValid || createMutation.isPending}
            >
              {createMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text className={`font-bold text-base ${isValid ? 'text-white' : 'text-slate-500'}`}>
                  Add to Inventory
                </Text>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

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
                  onPress={() => {
                    setSelectedVendor(null);
                    setShowVendorModal(false);
                  }}
                >
                  <View className="flex-row items-center justify-center gap-2">
                    <X size={18} color="#EF4444" />
                    <Text className="text-red-400 font-medium">Clear Selection</Text>
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
