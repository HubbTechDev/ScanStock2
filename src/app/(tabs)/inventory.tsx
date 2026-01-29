import React, { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, Image, RefreshControl, TextInput, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Package, Search, Plus, CheckCircle, Calendar, ArrowUp, ArrowDown, Camera, X, MapPin, Tag, ShoppingBag, UtensilsCrossed, Building2, ClipboardCheck, FileText } from 'lucide-react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, BACKEND_URL } from '@/lib/api';
import { useIndustryStore, INDUSTRY_CONFIGS } from '@/lib/industry-store';
import type { GetInventoryResponse, InventoryItem } from '@/shared/contracts';

type TabType = 'active' | 'completed';
type SortOrder = 'newest' | 'oldest';

const SORT_ORDER_KEY = 'inventory_sort_order';

const INDUSTRY_ICONS = {
  retail: ShoppingBag,
  restaurant: UtensilsCrossed,
  hospitality: Building2,
} as const;

export default function InventoryScreen() {
  const router = useRouter();
  const industry = useIndustryStore((s) => s.industry);
  const config = industry ? INDUSTRY_CONFIGS[industry] : null;
  const accentColor = config?.color ?? '#06B6D4';

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showPhotoSearch, setShowPhotoSearch] = useState(false);
  const [isSearchingByPhoto, setIsSearchingByPhoto] = useState(false);
  const [photoSearchResults, setPhotoSearchResults] = useState<string[]>([]);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  // Load saved sort order on mount
  useEffect(() => {
    const loadSortOrder = async () => {
      try {
        const saved = await AsyncStorage.getItem(SORT_ORDER_KEY);
        if (saved === 'newest' || saved === 'oldest') {
          setSortOrder(saved);
        }
      } catch (error) {
        console.log('Error loading sort order:', error);
      }
    };
    loadSortOrder();
  }, []);

  // Save sort order when it changes
  const handleSortOrderChange = async (newOrder: SortOrder) => {
    setSortOrder(newOrder);
    setShowSortMenu(false);
    try {
      await AsyncStorage.setItem(SORT_ORDER_KEY, newOrder);
    } catch (error) {
      console.log('Error saving sort order:', error);
    }
  };

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => api.get<GetInventoryResponse>('/api/inventory'),
  });

  const items: InventoryItem[] = data?.items ?? [];

  // Active items (pending status - in storage)
  const activeItems = items.filter((item) => item.status === 'pending');

  // Completed items
  const completedItems = items.filter((item) => item.status === 'completed');

  const currentItems = activeTab === 'active' ? activeItems : completedItems;

  // Sort items by date
  const sortedItems = [...currentItems].sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
  });

  const filteredItems = sortedItems.filter((item) => {
    // If photo search results exist, filter by those IDs
    if (photoSearchResults.length > 0) {
      return photoSearchResults.includes(item.id);
    }

    const matchesSearch =
      searchQuery === '' ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.binNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      (item.rackNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      (item.platform?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

    return matchesSearch;
  });

  const handlePhotoSearch = async (imageUri: string) => {
    setIsSearchingByPhoto(true);
    setShowPhotoSearch(false);

    try {
      // Convert image to base64
      const response = await fetch(imageUri);
      const blob = await response.blob();
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1] ?? '');
        };
        reader.readAsDataURL(blob);
      });

      // Search for similar items
      const result = await api.post<{ matchingItemIds: string[] }>('/api/inventory/search-by-photo', {
        image: base64,
        itemIds: currentItems.map(i => i.id),
      });

      setPhotoSearchResults(result.matchingItemIds);
    } catch (error) {
      console.error('Photo search error:', error);
      setPhotoSearchResults([]);
    } finally {
      setIsSearchingByPhoto(false);
    }
  };

  const takePhoto = async () => {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.5 });
    if (photo?.uri) {
      handlePhotoSearch(photo.uri);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.5,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      handlePhotoSearch(result.assets[0].uri);
    }
  };

  const clearPhotoSearch = () => {
    setPhotoSearchResults([]);
  };

  const getImageUrl = (imageUrl: string) => {
    if (imageUrl.startsWith('http')) return imageUrl;
    return `${BACKEND_URL}${imageUrl}`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  // Industry-specific labels
  const getActiveTabLabel = () => {
    switch (industry) {
      case 'retail': return 'In Stock';
      case 'restaurant': return 'Available';
      case 'hospitality': return 'Available';
      default: return 'Active';
    }
  };

  const getCompletedTabLabel = () => {
    switch (industry) {
      case 'retail': return 'Sold';
      case 'restaurant': return 'Used';
      case 'hospitality': return 'In Use';
      default: return 'Completed';
    }
  };

  const IndustryIcon = industry ? INDUSTRY_ICONS[industry] : Package;

  return (
    <View className="flex-1 bg-neutral-900">
      <LinearGradient
        colors={['#1C1C1E', '#2C2C2E', '#1C1C1E']}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />
      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <View className="px-5 pt-4 pb-4 flex-row items-center justify-between">
          <View>
            <View className="flex-row items-center gap-2 mb-1">
              <IndustryIcon size={14} color={accentColor} />
              <Text className="text-xs font-medium" style={{ color: accentColor }}>
                {config?.name ?? 'Inventory'}
              </Text>
            </View>
            <Text className="text-white text-2xl font-bold">Inventory</Text>
            <Text className="text-slate-400 text-sm mt-1">
              {activeItems.length} {getActiveTabLabel().toLowerCase()}, {completedItems.length} {getCompletedTabLabel().toLowerCase()}
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Pressable
              className="bg-slate-800/80 h-10 px-3 rounded-xl flex-row items-center justify-center border border-slate-700/50 active:opacity-80"
              onPress={() => router.push('/cycle-counts')}
            >
              <ClipboardCheck size={18} color={accentColor} />
              <Text className="text-xs font-semibold ml-1.5" style={{ color: accentColor }}>
                Cycle Count
              </Text>
            </Pressable>
            <Pressable
              className="bg-slate-800/80 h-10 px-3 rounded-xl flex-row items-center justify-center border border-slate-700/50 active:opacity-80"
              onPress={() => router.push('/invoice-input')}
            >
              <FileText size={18} color={accentColor} />
              <Text className="text-xs font-semibold ml-1.5" style={{ color: accentColor }}>
                Invoice Upload
              </Text>
            </Pressable>
            <Pressable
              className="w-10 h-10 rounded-xl items-center justify-center active:opacity-80"
              style={{ backgroundColor: accentColor }}
              onPress={() => router.push('/add-item')}
            >
              <Plus size={22} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        {/* Tabs */}
        <View className="px-5 mb-4">
          <View className="bg-slate-800/60 rounded-xl p-1 flex-row border border-slate-700/50">
            <Pressable
              className="flex-1 py-2.5 rounded-lg items-center"
              style={activeTab === 'active' ? { backgroundColor: accentColor } : undefined}
              onPress={() => setActiveTab('active')}
            >
              <Text className={`font-semibold ${activeTab === 'active' ? 'text-white' : 'text-slate-400'}`}>
                {getActiveTabLabel()} ({activeItems.length})
              </Text>
            </Pressable>
            <Pressable
              className={`flex-1 py-2.5 rounded-lg items-center ${
                activeTab === 'completed' ? 'bg-emerald-500' : ''
              }`}
              onPress={() => setActiveTab('completed')}
            >
              <Text className={`font-semibold ${activeTab === 'completed' ? 'text-white' : 'text-slate-400'}`}>
                {getCompletedTabLabel()} ({completedItems.length})
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Search Bar with Sort and Photo Search */}
        <View className="px-5 mb-4">
          <View className="flex-row items-center gap-2">
            {/* Search Input */}
            <View className="flex-1 bg-slate-800/60 rounded-xl flex-row items-center px-4 border border-slate-700/50">
              <Search size={20} color="#64748B" />
              <TextInput
                className="flex-1 py-3 px-3 text-white"
                placeholder={`Search ${getActiveTabLabel().toLowerCase()} items...`}
                placeholderTextColor="#64748B"
                value={searchQuery}
                onChangeText={(text) => {
                  setSearchQuery(text);
                  if (photoSearchResults.length > 0) clearPhotoSearch();
                }}
              />
            </View>

            {/* Photo Search Button */}
            <Pressable
              className="bg-slate-800/60 w-12 h-12 rounded-xl items-center justify-center border border-slate-700/50 active:opacity-80"
              onPress={() => setShowPhotoSearch(true)}
            >
              <Camera size={20} color={accentColor} />
            </Pressable>

            {/* Sort Button */}
            <Pressable
              className="bg-slate-800/60 w-12 h-12 rounded-xl items-center justify-center border border-slate-700/50 active:opacity-80"
              onPress={() => setShowSortMenu(true)}
            >
              {sortOrder === 'newest' ? (
                <ArrowDown size={20} color={accentColor} />
              ) : (
                <ArrowUp size={20} color={accentColor} />
              )}
            </Pressable>
          </View>

          {/* Photo Search Results Indicator */}
          {photoSearchResults.length > 0 && (
            <Pressable
              className="mt-2 rounded-lg px-3 py-2 flex-row items-center justify-between"
              style={{ backgroundColor: `${accentColor}20` }}
              onPress={clearPhotoSearch}
            >
              <Text style={{ color: accentColor }} className="text-sm">
                Found {photoSearchResults.length} matching item{photoSearchResults.length !== 1 ? 's' : ''}
              </Text>
              <X size={16} color={accentColor} />
            </Pressable>
          )}

          {/* Photo Searching Indicator */}
          {isSearchingByPhoto && (
            <View className="mt-2 bg-slate-700/50 rounded-lg px-3 py-2 flex-row items-center">
              <ActivityIndicator size="small" color={accentColor} />
              <Text className="text-slate-400 text-sm ml-2">Searching by photo...</Text>
            </View>
          )}
        </View>

        {/* Sort Menu Modal */}
        <Modal
          visible={showSortMenu}
          transparent
          animationType="fade"
          onRequestClose={() => setShowSortMenu(false)}
        >
          <Pressable
            className="flex-1 bg-black/60 justify-center items-center"
            onPress={() => setShowSortMenu(false)}
          >
            <View className="bg-slate-800 rounded-2xl w-72 overflow-hidden border border-slate-700">
              <Text className="text-white font-bold text-lg px-5 py-4 border-b border-slate-700">
                Sort By
              </Text>
              <Pressable
                className="px-5 py-4 flex-row items-center justify-between"
                style={sortOrder === 'newest' ? { backgroundColor: `${accentColor}20` } : undefined}
                onPress={() => handleSortOrderChange('newest')}
              >
                <View className="flex-row items-center">
                  <ArrowDown size={18} color={sortOrder === 'newest' ? accentColor : '#94A3B8'} />
                  <Text className={`ml-3 ${sortOrder === 'newest' ? 'font-semibold' : 'text-slate-300'}`} style={sortOrder === 'newest' ? { color: accentColor } : undefined}>
                    Newest First
                  </Text>
                </View>
                {sortOrder === 'newest' && <CheckCircle size={18} color={accentColor} />}
              </Pressable>
              <Pressable
                className="px-5 py-4 flex-row items-center justify-between"
                style={sortOrder === 'oldest' ? { backgroundColor: `${accentColor}20` } : undefined}
                onPress={() => handleSortOrderChange('oldest')}
              >
                <View className="flex-row items-center">
                  <ArrowUp size={18} color={sortOrder === 'oldest' ? accentColor : '#94A3B8'} />
                  <Text className={`ml-3 ${sortOrder === 'oldest' ? 'font-semibold' : 'text-slate-300'}`} style={sortOrder === 'oldest' ? { color: accentColor } : undefined}>
                    Oldest First
                  </Text>
                </View>
                {sortOrder === 'oldest' && <CheckCircle size={18} color={accentColor} />}
              </Pressable>
            </View>
          </Pressable>
        </Modal>

        {/* Photo Search Modal */}
        <Modal
          visible={showPhotoSearch}
          animationType="slide"
          onRequestClose={() => setShowPhotoSearch(false)}
        >
          <View className="flex-1 bg-neutral-900">
            <SafeAreaView className="flex-1">
              {/* Header */}
              <View className="px-5 py-4 flex-row items-center justify-between border-b border-slate-800">
                <Text className="text-white text-xl font-bold">Find by Photo</Text>
                <Pressable
                  className="w-10 h-10 rounded-full bg-slate-800 items-center justify-center"
                  onPress={() => setShowPhotoSearch(false)}
                >
                  <X size={20} color="#FFFFFF" />
                </Pressable>
              </View>

              {/* Camera or Permission Request */}
              {!permission?.granted ? (
                <View className="flex-1 justify-center items-center px-8">
                  <Camera size={64} color="#64748B" />
                  <Text className="text-white text-lg font-semibold mt-4 text-center">
                    Camera Access Required
                  </Text>
                  <Text className="text-slate-400 text-center mt-2">
                    Allow camera access to search for items by taking a photo
                  </Text>
                  <Pressable
                    className="rounded-xl px-8 py-4 mt-6 active:opacity-80"
                    style={{ backgroundColor: accentColor }}
                    onPress={requestPermission}
                  >
                    <Text className="text-white font-bold">Grant Permission</Text>
                  </Pressable>
                  <Pressable
                    className="mt-4 active:opacity-80"
                    onPress={pickImage}
                  >
                    <Text className="font-semibold" style={{ color: accentColor }}>Choose from Library Instead</Text>
                  </Pressable>
                </View>
              ) : (
                <View className="flex-1">
                  <CameraView
                    ref={cameraRef}
                    style={{ flex: 1 }}
                    facing="back"
                  >
                    {/* Camera Overlay */}
                    <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: 40 }}>
                      <View className="flex-row items-center justify-center gap-6">
                        {/* Gallery Button */}
                        <Pressable
                          className="w-14 h-14 rounded-full bg-slate-800/80 items-center justify-center active:opacity-80"
                          onPress={pickImage}
                        >
                          <Package size={24} color="#FFFFFF" />
                        </Pressable>

                        {/* Capture Button */}
                        <Pressable
                          className="w-20 h-20 rounded-full bg-white items-center justify-center active:opacity-80"
                          onPress={takePhoto}
                        >
                          <View className="w-16 h-16 rounded-full" style={{ backgroundColor: accentColor }} />
                        </Pressable>

                        {/* Placeholder for symmetry */}
                        <View className="w-14 h-14" />
                      </View>
                    </View>
                  </CameraView>
                </View>
              )}
            </SafeAreaView>
          </View>
        </Modal>

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
              {activeTab === 'active' ? (
                <>
                  <Package size={40} color="#64748B" />
                  <Text className="text-slate-400 mt-3 text-center">
                    {searchQuery ? 'No matching items' : `No ${getActiveTabLabel().toLowerCase()} items`}
                  </Text>
                  {!searchQuery && (
                    <Pressable
                      className="rounded-xl px-6 py-3 mt-4 active:opacity-80"
                      style={{ backgroundColor: accentColor }}
                      onPress={() => router.push('/add-item')}
                    >
                      <Text className="text-white font-bold">Add New Item</Text>
                    </Pressable>
                  )}
                </>
              ) : (
                <>
                  <CheckCircle size={40} color="#64748B" />
                  <Text className="text-slate-400 mt-3 text-center">
                    {searchQuery ? 'No matching items' : `No ${getCompletedTabLabel().toLowerCase()} items yet`}
                  </Text>
                </>
              )}
            </View>
          ) : (
            filteredItems.map((item) => (
              <Pressable
                key={item.id}
                className="bg-slate-800/60 rounded-2xl p-4 mb-3 flex-row items-center border active:opacity-80"
                style={{ borderColor: activeTab === 'completed' ? '#10B98130' : 'rgba(51, 65, 85, 0.5)' }}
                onPress={() => router.push(`/item/${item.id}`)}
              >
                <Image
                  source={{ uri: getImageUrl(item.imageUrl) }}
                  className="w-20 h-20 rounded-xl bg-slate-700"
                />
                <View className="flex-1 ml-4">
                  <Text className="text-white font-bold text-base" numberOfLines={1}>
                    {item.name}
                  </Text>
                  <View className="flex-row items-center mt-2 gap-2 flex-wrap">
                    {item.binNumber ? (
                      <View className="bg-slate-700/50 px-2 py-1 rounded flex-row items-center">
                        <MapPin size={10} color="#94A3B8" />
                        <Text className="text-slate-300 text-xs ml-1">{item.binNumber}</Text>
                      </View>
                    ) : null}
                    {item.rackNumber ? (
                      <View className="bg-slate-700/50 px-2 py-1 rounded flex-row items-center">
                        <Tag size={10} color="#94A3B8" />
                        <Text className="text-slate-300 text-xs ml-1">{item.rackNumber}</Text>
                      </View>
                    ) : null}
                  </View>
                  {item.platform ? (
                    <Text className="text-xs mt-2" style={{ color: accentColor }}>{item.platform}</Text>
                  ) : null}
                </View>
                {activeTab === 'completed' && (
                  <View className="items-end">
                    <View className="flex-row items-center">
                      <Calendar size={12} color="#64748B" />
                      <Text className="text-slate-400 text-xs ml-1">
                        {formatDate(item.updatedAt)}
                      </Text>
                    </View>
                    <View className="flex-row items-center mt-2">
                      <CheckCircle size={12} color="#10B981" />
                      <Text className="text-emerald-400 text-xs ml-1">Done</Text>
                    </View>
                  </View>
                )}
              </Pressable>
            ))
          )}
          <View className="h-8" />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
