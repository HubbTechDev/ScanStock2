import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  Plus,
  FileText,
  Search,
  Check,
  X,
  Package,
  Trash2,
  Link,
  PlusCircle,
  Camera,
  Upload,
  DollarSign,
  Hash,
  ChevronRight,
  AlertCircle,
  ScanLine,
  Image as ImageIcon,
  Sparkles,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { api, BACKEND_URL } from '@/lib/api';
import { useIndustryStore, INDUSTRY_CONFIGS } from '@/lib/industry-store';
import { useStorageLocations } from '@/lib/storage-locations';
import { scanInvoiceImage, isOpenAIConfigured } from '@/lib/openai';
import type { GetInventoryResponse, InventoryItem, CreateInventoryItemRequest } from '@/shared/contracts';

type InvoiceItem = {
  id: string;
  productName: string;
  quantity: string;
  unitCost: string;
  matchedInventoryItem: InventoryItem | null;
  isNewItem: boolean;
  isScanned?: boolean;
};

type AddNewItemState = {
  invoiceItemId: string;
  productName: string;
  quantity: string;
  cost: string;
  description: string;
  imageUri: string | null;
  uploadedImageUrl: string | null;
  locationValues: Record<string, string>;
};

export default function InvoiceInputScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { locationFields, isLoaded, loadLocations } = useStorageLocations();

  const industry = useIndustryStore((s) => s.industry);
  const config = industry ? INDUSTRY_CONFIGS[industry] : null;
  const accentColor = config?.color ?? '#06B6D4';

  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [selectedInvoiceItemId, setSelectedInvoiceItemId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddNewModal, setShowAddNewModal] = useState(false);
  const [addNewItemState, setAddNewItemState] = useState<AddNewItemState | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  const enabledFields = locationFields.filter((f) => f.enabled);

  // Invoice scanning functions
  const scanInvoiceFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.9,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      await processInvoiceScan(result.assets[0].uri);
    }
  };

  const scanInvoiceFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.9,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      await processInvoiceScan(result.assets[0].uri);
    }
  };

  const processInvoiceScan = async (imageUri: string) => {
    if (!isOpenAIConfigured()) {
      setScanError('AI is not configured. Please set up the OpenAI API key in the API tab.');
      return;
    }

    setIsScanning(true);
    setScanError(null);

    try {
      const scanResult = await scanInvoiceImage(imageUri);

      if (scanResult.items.length === 0) {
        setScanError('No items found in the invoice. Please try a clearer image.');
        return;
      }

      // Convert scanned items to invoice items
      const newItems: InvoiceItem[] = scanResult.items.map((item, index) => {
        const match = findBestMatch(item.productName);
        return {
          id: `scan_${Date.now()}_${index}`,
          productName: item.productName,
          quantity: item.quantity.toString(),
          unitCost: item.unitCost ? item.unitCost.toFixed(2) : '',
          matchedInventoryItem: match,
          isNewItem: false,
          isScanned: true,
        };
      });

      setInvoiceItems(prev => [...prev, ...newItems]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Invoice scan error:', error);
      setScanError('Failed to scan invoice. Please try again.');
    } finally {
      setIsScanning(false);
    }
  };

  // Fetch existing inventory for matching
  const { data: inventoryData } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => api.get<GetInventoryResponse>('/api/inventory'),
  });

  const existingItems = inventoryData?.items ?? [];

  // Mutation for creating new inventory items
  const createItemMutation = useMutation({
    mutationFn: (data: CreateInventoryItemRequest) =>
      api.post<InventoryItem>('/api/inventory', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });

  // Mutation for updating existing inventory items (add quantity)
  const updateItemMutation = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) =>
      api.patch<InventoryItem>(`/api/inventory/${id}`, { quantity }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });

  // Add new empty invoice line
  const addInvoiceLine = () => {
    const newItem: InvoiceItem = {
      id: Date.now().toString(),
      productName: '',
      quantity: '1',
      unitCost: '',
      matchedInventoryItem: null,
      isNewItem: false,
    };
    setInvoiceItems([...invoiceItems, newItem]);
  };

  // Update invoice line
  const updateInvoiceLine = (id: string, field: keyof InvoiceItem, value: string | InventoryItem | null | boolean) => {
    setInvoiceItems(items =>
      items.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  // Remove invoice line
  const removeInvoiceLine = (id: string) => {
    setInvoiceItems(items => items.filter(item => item.id !== id));
  };

  // Auto-match product name to existing inventory
  const findBestMatch = (productName: string): InventoryItem | null => {
    if (!productName.trim()) return null;

    const searchLower = productName.toLowerCase();

    // First try exact match
    const exactMatch = existingItems.find(
      item => item.name.toLowerCase() === searchLower
    );
    if (exactMatch) return exactMatch;

    // Then try includes match
    const includesMatch = existingItems.find(
      item => item.name.toLowerCase().includes(searchLower) ||
              searchLower.includes(item.name.toLowerCase())
    );
    return includesMatch ?? null;
  };

  // Handle product name blur - auto-match
  const handleProductNameBlur = (invoiceItemId: string, productName: string) => {
    const match = findBestMatch(productName);
    if (match) {
      updateInvoiceLine(invoiceItemId, 'matchedInventoryItem', match);
      updateInvoiceLine(invoiceItemId, 'isNewItem', false);
    }
  };

  // Open match modal
  const openMatchModal = (invoiceItemId: string) => {
    setSelectedInvoiceItemId(invoiceItemId);
    const item = invoiceItems.find(i => i.id === invoiceItemId);
    setSearchQuery(item?.productName ?? '');
    setShowMatchModal(true);
  };

  // Select match from modal
  const selectMatch = (inventoryItem: InventoryItem) => {
    if (selectedInvoiceItemId) {
      updateInvoiceLine(selectedInvoiceItemId, 'matchedInventoryItem', inventoryItem);
      updateInvoiceLine(selectedInvoiceItemId, 'isNewItem', false);
    }
    setShowMatchModal(false);
    setSelectedInvoiceItemId(null);
  };

  // Mark as new item (will create in inventory)
  const markAsNewItem = (invoiceItemId: string) => {
    const item = invoiceItems.find(i => i.id === invoiceItemId);
    if (!item) return;

    setAddNewItemState({
      invoiceItemId,
      productName: item.productName,
      quantity: item.quantity,
      cost: item.unitCost,
      description: '',
      imageUri: null,
      uploadedImageUrl: null,
      locationValues: {},
    });
    setShowAddNewModal(true);
    setShowMatchModal(false);
  };

  // Upload image for new item
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

      const data = await response.json();
      if (data.success) {
        setAddNewItemState(prev => prev ? { ...prev, uploadedImageUrl: data.url } : null);
      }
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setAddNewItemState(prev => prev ? { ...prev, imageUri: result.assets[0]?.uri ?? null } : null);
      if (result.assets[0]?.uri) {
        uploadImage(result.assets[0].uri);
      }
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setAddNewItemState(prev => prev ? { ...prev, imageUri: result.assets[0]?.uri ?? null } : null);
      if (result.assets[0]?.uri) {
        uploadImage(result.assets[0].uri);
      }
    }
  };

  // Save new item details
  const saveNewItemDetails = () => {
    if (!addNewItemState) return;

    // Update the invoice item to mark as new with details
    updateInvoiceLine(addNewItemState.invoiceItemId, 'isNewItem', true);
    updateInvoiceLine(addNewItemState.invoiceItemId, 'matchedInventoryItem', null);
    updateInvoiceLine(addNewItemState.invoiceItemId, 'productName', addNewItemState.productName);
    updateInvoiceLine(addNewItemState.invoiceItemId, 'quantity', addNewItemState.quantity);
    updateInvoiceLine(addNewItemState.invoiceItemId, 'unitCost', addNewItemState.cost);

    setShowAddNewModal(false);
    setAddNewItemState(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // Process all invoice items
  const processInvoice = async () => {
    const itemsToProcess = invoiceItems.filter(
      item => item.productName.trim() && (item.matchedInventoryItem || item.isNewItem)
    );

    if (itemsToProcess.length === 0) {
      return;
    }

    setIsProcessing(true);

    try {
      for (const item of itemsToProcess) {
        const qty = parseInt(item.quantity, 10) || 1;
        const cost = parseFloat(item.unitCost) || undefined;

        if (item.matchedInventoryItem) {
          // Update existing item quantity
          const newQty = (item.matchedInventoryItem.quantity || 0) + qty;
          await updateItemMutation.mutateAsync({
            id: item.matchedInventoryItem.id,
            quantity: newQty,
          });
        } else if (item.isNewItem && addNewItemState?.uploadedImageUrl) {
          // Create new item
          const binField = enabledFields.find((f) => f.id === 'bin');
          const rackField = enabledFields.find((f) => f.id === 'rack');

          await createItemMutation.mutateAsync({
            name: item.productName,
            description: addNewItemState.description || undefined,
            imageUrl: addNewItemState.uploadedImageUrl,
            binNumber: binField
              ? addNewItemState.locationValues[binField.id] || undefined
              : addNewItemState.locationValues[enabledFields[0]?.id] || undefined,
            rackNumber: rackField
              ? addNewItemState.locationValues[rackField.id] || undefined
              : addNewItemState.locationValues[enabledFields[1]?.id] || undefined,
            quantity: qty,
            cost,
            status: 'pending',
          });
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (error) {
      console.error('Error processing invoice:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const getImageUrl = (imageUrl: string) => {
    if (imageUrl.startsWith('http')) return imageUrl;
    return `${BACKEND_URL}${imageUrl}`;
  };

  // Filter inventory for search
  const filteredInventory = existingItems.filter(item =>
    searchQuery === '' ||
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const processableItems = invoiceItems.filter(
    item => item.productName.trim() && (item.matchedInventoryItem || item.isNewItem)
  );

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
              <FileText size={14} color={accentColor} />
              <Text className="text-xs font-medium" style={{ color: accentColor }}>
                Inventory
              </Text>
            </View>
            <Text className="text-white text-xl font-bold text-center">
              Invoice Input
            </Text>
          </View>

          <Pressable
            className="w-10 h-10 rounded-full items-center justify-center active:opacity-80"
            style={{ backgroundColor: processableItems.length > 0 ? accentColor : '#334155' }}
            onPress={processInvoice}
            disabled={processableItems.length === 0 || isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Check size={20} color={processableItems.length > 0 ? '#FFFFFF' : '#64748B'} />
            )}
          </Pressable>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
            {/* AI Scan Section */}
            <View className="bg-slate-800/60 rounded-2xl p-4 mb-4 border border-slate-700/50">
              <View className="flex-row items-center mb-3">
                <View
                  className="w-10 h-10 rounded-full items-center justify-center mr-3"
                  style={{ backgroundColor: `${accentColor}20` }}
                >
                  <ScanLine size={20} color={accentColor} />
                </View>
                <View className="flex-1">
                  <Text className="text-white font-bold">Smart Scan Invoice</Text>
                  <Text className="text-slate-400 text-xs">
                    Use AI to extract items from a photo
                  </Text>
                </View>
              </View>

              {isScanning ? (
                <View className="bg-slate-700/50 rounded-xl p-6 items-center">
                  <ActivityIndicator size="large" color={accentColor} />
                  <Text className="text-white mt-3 font-medium">Scanning invoice...</Text>
                  <Text className="text-slate-400 text-xs mt-1">
                    Extracting product information
                  </Text>
                </View>
              ) : (
                <View className="flex-row gap-3">
                  <Pressable
                    className="flex-1 rounded-xl py-3 flex-row items-center justify-center active:opacity-80"
                    style={{ backgroundColor: accentColor }}
                    onPress={scanInvoiceFromCamera}
                  >
                    <Camera size={18} color="#FFFFFF" />
                    <Text className="text-white font-semibold ml-2">Camera</Text>
                  </Pressable>
                  <Pressable
                    className="flex-1 bg-slate-700 rounded-xl py-3 flex-row items-center justify-center active:opacity-80"
                    onPress={scanInvoiceFromGallery}
                  >
                    <ImageIcon size={18} color="#FFFFFF" />
                    <Text className="text-white font-semibold ml-2">Gallery</Text>
                  </Pressable>
                </View>
              )}

              {scanError && (
                <View className="bg-red-500/20 rounded-xl p-3 mt-3 flex-row items-center">
                  <AlertCircle size={16} color="#EF4444" />
                  <Text className="text-red-400 text-sm ml-2 flex-1">{scanError}</Text>
                </View>
              )}
            </View>

            {/* Divider */}
            <View className="flex-row items-center mb-4">
              <View className="flex-1 h-px bg-slate-700" />
              <Text className="text-slate-500 text-xs mx-4">OR ENTER MANUALLY</Text>
              <View className="flex-1 h-px bg-slate-700" />
            </View>

            {/* Instructions */}
            <View className="bg-slate-800/60 rounded-2xl p-4 mb-4 border border-slate-700/50">
              <Text className="text-slate-300 text-sm">
                Enter products from your invoice. They'll be matched to existing inventory or you can add them as new items.
              </Text>
            </View>

            {/* Invoice Lines */}
            {invoiceItems.length === 0 ? (
              <View className="bg-slate-800/60 rounded-2xl p-8 items-center border border-slate-700/50 mb-4">
                <FileText size={40} color="#64748B" />
                <Text className="text-slate-400 mt-3 text-center">
                  No invoice items yet
                </Text>
                <Pressable
                  className="rounded-xl px-6 py-3 mt-4 active:opacity-80"
                  style={{ backgroundColor: accentColor }}
                  onPress={addInvoiceLine}
                >
                  <Text className="text-white font-bold">Add First Item</Text>
                </Pressable>
              </View>
            ) : (
              invoiceItems.map((item, index) => (
                <Animated.View
                  key={item.id}
                  entering={FadeInDown.delay(index * 50).springify()}
                  className="bg-slate-800/60 rounded-2xl p-4 mb-3 border border-slate-700/50"
                >
                  {/* Line Header */}
                  <View className="flex-row items-center justify-between mb-3">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-slate-400 text-xs font-medium">
                        Item #{index + 1}
                      </Text>
                      {item.isScanned && (
                        <View className="flex-row items-center bg-violet-500/20 rounded-full px-2 py-0.5">
                          <Sparkles size={10} color="#A78BFA" />
                          <Text className="text-violet-400 text-[10px] font-medium ml-1">
                            AI Scanned - Tap to Edit
                          </Text>
                        </View>
                      )}
                    </View>
                    <Pressable
                      className="w-8 h-8 rounded-lg bg-slate-700/50 items-center justify-center active:opacity-80"
                      onPress={() => removeInvoiceLine(item.id)}
                    >
                      <Trash2 size={16} color="#EF4444" />
                    </Pressable>
                  </View>

                  {/* Product Name */}
                  <View className="mb-3">
                    <Text className="text-slate-400 text-xs mb-1">Product Name</Text>
                    <TextInput
                      className="bg-slate-700/50 rounded-xl px-4 py-3 text-white"
                      placeholder="Enter product name"
                      placeholderTextColor="#64748B"
                      value={item.productName}
                      onChangeText={(text) => updateInvoiceLine(item.id, 'productName', text)}
                      onBlur={() => handleProductNameBlur(item.id, item.productName)}
                    />
                  </View>

                  {/* Quantity and Cost Row */}
                  <View className="flex-row gap-3 mb-3">
                    <View className="flex-1">
                      <Text className="text-slate-400 text-xs mb-1">Quantity</Text>
                      <View className="flex-row items-center bg-slate-700/50 rounded-xl">
                        <View className="pl-3 pr-1">
                          <Hash size={16} color="#64748B" />
                        </View>
                        <TextInput
                          className="flex-1 py-3 pr-3 text-white"
                          placeholder="1"
                          placeholderTextColor="#64748B"
                          value={item.quantity}
                          onChangeText={(text) => updateInvoiceLine(item.id, 'quantity', text)}
                          keyboardType="number-pad"
                        />
                      </View>
                    </View>
                    <View className="flex-1">
                      <Text className="text-slate-400 text-xs mb-1">Unit Cost</Text>
                      <View className="flex-row items-center bg-slate-700/50 rounded-xl">
                        <View className="pl-3 pr-1">
                          <DollarSign size={16} color="#64748B" />
                        </View>
                        <TextInput
                          className="flex-1 py-3 pr-3 text-white"
                          placeholder="0.00"
                          placeholderTextColor="#64748B"
                          value={item.unitCost}
                          onChangeText={(text) => updateInvoiceLine(item.id, 'unitCost', text)}
                          keyboardType="decimal-pad"
                        />
                      </View>
                    </View>
                  </View>

                  {/* Match Status */}
                  {item.matchedInventoryItem ? (
                    <Pressable
                      className="bg-emerald-500/20 rounded-xl p-3 flex-row items-center justify-between active:opacity-80"
                      onPress={() => openMatchModal(item.id)}
                    >
                      <View className="flex-row items-center flex-1">
                        <Image
                          source={{ uri: getImageUrl(item.matchedInventoryItem.imageUrl) }}
                          className="w-10 h-10 rounded-lg bg-slate-700 mr-3"
                        />
                        <View className="flex-1">
                          <View className="flex-row items-center">
                            <Link size={12} color="#10B981" />
                            <Text className="text-emerald-400 text-xs font-medium ml-1">
                              Matched
                            </Text>
                          </View>
                          <Text className="text-white text-sm font-semibold" numberOfLines={1}>
                            {item.matchedInventoryItem.name}
                          </Text>
                          <Text className="text-slate-400 text-xs">
                            Current qty: {item.matchedInventoryItem.quantity ?? 0}
                          </Text>
                        </View>
                      </View>
                      <ChevronRight size={16} color="#64748B" />
                    </Pressable>
                  ) : item.isNewItem ? (
                    <Pressable
                      className="bg-violet-500/20 rounded-xl p-3 flex-row items-center justify-between active:opacity-80"
                      onPress={() => markAsNewItem(item.id)}
                    >
                      <View className="flex-row items-center">
                        <PlusCircle size={16} color="#8B5CF6" />
                        <Text className="text-violet-400 text-sm font-medium ml-2">
                          Will create new item
                        </Text>
                      </View>
                      <ChevronRight size={16} color="#64748B" />
                    </Pressable>
                  ) : item.productName.trim() ? (
                    <Pressable
                      className="bg-amber-500/20 rounded-xl p-3 flex-row items-center justify-between active:opacity-80"
                      onPress={() => openMatchModal(item.id)}
                    >
                      <View className="flex-row items-center">
                        <AlertCircle size={16} color="#F59E0B" />
                        <Text className="text-amber-400 text-sm font-medium ml-2">
                          No match found - tap to link or add new
                        </Text>
                      </View>
                      <ChevronRight size={16} color="#64748B" />
                    </Pressable>
                  ) : null}
                </Animated.View>
              ))
            )}

            {/* Add Line Button */}
            {invoiceItems.length > 0 && (
              <Pressable
                className="bg-slate-800/40 rounded-2xl p-4 mb-4 border border-dashed border-slate-600 flex-row items-center justify-center active:opacity-80"
                onPress={addInvoiceLine}
              >
                <Plus size={20} color={accentColor} />
                <Text className="font-semibold ml-2" style={{ color: accentColor }}>
                  Add Another Item
                </Text>
              </Pressable>
            )}

            {/* Summary */}
            {processableItems.length > 0 && (
              <View className="bg-slate-800/60 rounded-2xl p-4 mb-4 border border-slate-700/50">
                <Text className="text-white font-bold mb-2">Summary</Text>
                <Text className="text-slate-400 text-sm">
                  {processableItems.filter(i => i.matchedInventoryItem).length} items to update,{' '}
                  {processableItems.filter(i => i.isNewItem).length} new items to create
                </Text>
              </View>
            )}

            <View className="h-8" />
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Match Modal */}
        <Modal visible={showMatchModal} transparent animationType="slide">
          <View className="flex-1 bg-black/60 justify-end">
            <View className="bg-slate-800 rounded-t-3xl max-h-[80%]">
              {/* Header */}
              <View className="p-5 border-b border-slate-700 flex-row items-center justify-between">
                <Text className="text-white font-bold text-lg">Link to Inventory</Text>
                <Pressable onPress={() => setShowMatchModal(false)}>
                  <X size={24} color="#94A3B8" />
                </Pressable>
              </View>

              {/* Search */}
              <View className="p-4 border-b border-slate-700">
                <View className="bg-slate-700/50 rounded-xl flex-row items-center px-4">
                  <Search size={20} color="#64748B" />
                  <TextInput
                    className="flex-1 py-3 px-3 text-white"
                    placeholder="Search inventory..."
                    placeholderTextColor="#64748B"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                </View>
              </View>

              {/* Create New Option */}
              <Pressable
                className="mx-4 mt-4 bg-violet-500/20 rounded-xl p-4 flex-row items-center justify-between active:opacity-80"
                onPress={() => selectedInvoiceItemId && markAsNewItem(selectedInvoiceItemId)}
              >
                <View className="flex-row items-center">
                  <PlusCircle size={20} color="#8B5CF6" />
                  <Text className="text-violet-400 font-semibold ml-3">
                    Add as New Inventory Item
                  </Text>
                </View>
                <ChevronRight size={16} color="#8B5CF6" />
              </Pressable>

              {/* Inventory List */}
              <ScrollView className="p-4" showsVerticalScrollIndicator={false}>
                {filteredInventory.length === 0 ? (
                  <View className="items-center py-8">
                    <Package size={40} color="#64748B" />
                    <Text className="text-slate-400 mt-3">No matching items found</Text>
                  </View>
                ) : (
                  filteredInventory.map((item) => (
                    <Pressable
                      key={item.id}
                      className="bg-slate-700/30 rounded-xl p-3 mb-2 flex-row items-center active:opacity-80"
                      onPress={() => selectMatch(item)}
                    >
                      <Image
                        source={{ uri: getImageUrl(item.imageUrl) }}
                        className="w-12 h-12 rounded-lg bg-slate-700 mr-3"
                      />
                      <View className="flex-1">
                        <Text className="text-white font-semibold" numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text className="text-slate-400 text-xs">
                          Qty: {item.quantity ?? 0} | {item.binNumber ?? 'No location'}
                        </Text>
                      </View>
                      <Check size={20} color={accentColor} />
                    </Pressable>
                  ))
                )}
                <View className="h-8" />
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Add New Item Modal */}
        <Modal visible={showAddNewModal} animationType="slide">
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
                    onPress={() => {
                      setShowAddNewModal(false);
                      setAddNewItemState(null);
                    }}
                  >
                    <X size={20} color="#F8FAFC" />
                  </Pressable>
                  <Text className="text-white text-lg font-bold">New Item Details</Text>
                  <Pressable
                    className="w-10 h-10 rounded-full items-center justify-center"
                    style={{
                      backgroundColor:
                        addNewItemState?.uploadedImageUrl && addNewItemState?.productName
                          ? accentColor
                          : '#334155',
                    }}
                    onPress={saveNewItemDetails}
                    disabled={!addNewItemState?.uploadedImageUrl || !addNewItemState?.productName}
                  >
                    <Check
                      size={20}
                      color={
                        addNewItemState?.uploadedImageUrl && addNewItemState?.productName
                          ? '#FFFFFF'
                          : '#64748B'
                      }
                    />
                  </Pressable>
                </View>

                <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
                  {/* Image Upload */}
                  <View className="mb-6">
                    <Text className="text-white font-semibold mb-3">Item Photo *</Text>
                    {!addNewItemState?.imageUri ? (
                      <View className="bg-slate-800/60 rounded-2xl p-8 items-center border border-slate-700/50 border-dashed">
                        <View
                          className="w-16 h-16 rounded-full items-center justify-center mb-4"
                          style={{ backgroundColor: `${accentColor}20` }}
                        >
                          <Package size={32} color={accentColor} />
                        </View>
                        <Text className="text-slate-400 text-sm text-center mb-4">
                          Take a photo or upload from gallery
                        </Text>
                        <View className="flex-row gap-3">
                          <Pressable
                            className="rounded-xl px-5 py-2.5 flex-row items-center gap-2 active:opacity-80"
                            style={{ backgroundColor: accentColor }}
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
                          source={{ uri: addNewItemState.imageUri }}
                          className="w-full h-48 rounded-xl bg-slate-700"
                          resizeMode="cover"
                        />
                        {isUploading && (
                          <View className="absolute inset-0 bg-slate-900/80 rounded-2xl items-center justify-center">
                            <ActivityIndicator size="large" color={accentColor} />
                            <Text className="text-white mt-2">Uploading...</Text>
                          </View>
                        )}
                        {!isUploading && addNewItemState.uploadedImageUrl && (
                          <View className="absolute top-6 right-6 bg-emerald-500 w-8 h-8 rounded-full items-center justify-center">
                            <Check size={16} color="#FFFFFF" />
                          </View>
                        )}
                        <Pressable
                          className="absolute top-6 left-6 bg-slate-900/80 px-3 py-1.5 rounded-full active:opacity-80"
                          onPress={() => {
                            setAddNewItemState(prev =>
                              prev ? { ...prev, imageUri: null, uploadedImageUrl: null } : null
                            );
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
                      value={addNewItemState?.productName ?? ''}
                      onChangeText={(text) =>
                        setAddNewItemState(prev => prev ? { ...prev, productName: text } : null)
                      }
                    />
                  </View>

                  {/* Description */}
                  <View className="mb-4">
                    <Text className="text-white font-semibold mb-2">Description</Text>
                    <TextInput
                      className="bg-slate-800/60 rounded-xl px-4 py-3.5 text-white border border-slate-700/50"
                      placeholder="Optional description"
                      placeholderTextColor="#64748B"
                      value={addNewItemState?.description ?? ''}
                      onChangeText={(text) =>
                        setAddNewItemState(prev => prev ? { ...prev, description: text } : null)
                      }
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                    />
                  </View>

                  {/* Location Fields */}
                  {enabledFields.length > 0 && (
                    <View className="mb-4">
                      <Text className="text-white font-semibold mb-3">Storage Location</Text>
                      <View className="flex-row flex-wrap gap-3">
                        {enabledFields.map((field) => (
                          <View key={field.id} className="flex-1 min-w-[140px]">
                            <Text className="text-slate-400 text-xs mb-2">{field.name}</Text>
                            <TextInput
                              className="bg-slate-800/60 rounded-xl px-4 py-3.5 text-white border border-slate-700/50"
                              placeholder={field.placeholder}
                              placeholderTextColor="#64748B"
                              value={addNewItemState?.locationValues[field.id] ?? ''}
                              onChangeText={(text) =>
                                setAddNewItemState(prev =>
                                  prev
                                    ? {
                                        ...prev,
                                        locationValues: { ...prev.locationValues, [field.id]: text },
                                      }
                                    : null
                                )
                              }
                            />
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  <View className="h-8" />
                </ScrollView>
              </KeyboardAvoidingView>
            </SafeAreaView>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}
