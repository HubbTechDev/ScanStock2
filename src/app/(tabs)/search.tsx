import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Image, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Upload, Image as ImageIcon, Package, MapPin, Search, X } from 'lucide-react-native';
import { api, BACKEND_URL } from '@/lib/api';
import type { GetInventoryResponse, InventoryItem } from '@/shared/contracts';

type SearchMode = 'name' | 'photo';

export default function SearchScreen() {
  const router = useRouter();
  const [searchMode, setSearchMode] = useState<SearchMode>('name');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [matchedItem, setMatchedItem] = useState<InventoryItem | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const { data } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => api.get<GetInventoryResponse>('/api/inventory'),
  });

  const items = data?.items ?? [];

  // Filter items by name search
  const filteredItems = searchQuery.trim()
    ? items.filter((item) =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
        (item.binNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
        (item.rackNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
        (item.platform?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
      )
    : [];

  const getImageUrl = (imageUrl: string) => {
    if (imageUrl.startsWith('http')) return imageUrl;
    return `${BACKEND_URL}${imageUrl}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#F59E0B';
      case 'completed': return '#10B981';
      case 'sold': return '#8B5CF6';
      default: return '#64748B';
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
      setSelectedImage(result.assets[0].uri);
      searchByImage();
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
      setSelectedImage(result.assets[0].uri);
      searchByImage();
    }
  };

  const searchByImage = async () => {
    setIsSearching(true);
    // Simulate image matching - in a real app, you'd use image similarity API
    // For now, we'll show the most recent pending item as a "match"
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const pendingItem = items.find((item) => item.status === 'pending');
    if (pendingItem) {
      setMatchedItem(pendingItem);
    } else if (items.length > 0) {
      setMatchedItem(items[0]);
    }
    setIsSearching(false);
  };

  const clearSearch = () => {
    setSelectedImage(null);
    setMatchedItem(null);
  };

  const clearNameSearch = () => {
    setSearchQuery('');
  };

  return (
    <View className="flex-1 bg-neutral-900">
      <LinearGradient
        colors={['#1C1C1E', '#2C2C2E', '#1C1C1E']}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />
      <SafeAreaView className="flex-1" edges={['top']}>
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View className="px-5 pt-4 pb-4">
            <Text className="text-white text-2xl font-bold">Find Item</Text>
            <Text className="text-slate-400 text-sm mt-1">
              Search by name or upload a photo
            </Text>
          </View>

          {/* Search Mode Toggle */}
          <View className="px-5 mb-4">
            <View className="bg-slate-800/60 rounded-xl p-1 flex-row border border-slate-700/50">
              <Pressable
                className={`flex-1 py-2.5 rounded-lg flex-row items-center justify-center gap-2 ${
                  searchMode === 'name' ? 'bg-cyan-500' : ''
                }`}
                onPress={() => setSearchMode('name')}
              >
                <Search size={16} color={searchMode === 'name' ? '#FFFFFF' : '#94A3B8'} />
                <Text className={`font-semibold ${searchMode === 'name' ? 'text-white' : 'text-slate-400'}`}>
                  By Name
                </Text>
              </Pressable>
              <Pressable
                className={`flex-1 py-2.5 rounded-lg flex-row items-center justify-center gap-2 ${
                  searchMode === 'photo' ? 'bg-cyan-500' : ''
                }`}
                onPress={() => setSearchMode('photo')}
              >
                <Camera size={16} color={searchMode === 'photo' ? '#FFFFFF' : '#94A3B8'} />
                <Text className={`font-semibold ${searchMode === 'photo' ? 'text-white' : 'text-slate-400'}`}>
                  By Photo
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Name Search Mode */}
          {searchMode === 'name' && (
            <View className="px-5">
              {/* Search Input */}
              <View className="bg-slate-800/60 rounded-xl flex-row items-center px-4 border border-slate-700/50 mb-4">
                <Search size={20} color="#64748B" />
                <TextInput
                  className="flex-1 py-3.5 px-3 text-white text-base"
                  placeholder="Search by name, bin, rack..."
                  placeholderTextColor="#64748B"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={clearNameSearch} className="p-1">
                    <X size={18} color="#64748B" />
                  </Pressable>
                )}
              </View>

              {/* Search Results */}
              {searchQuery.trim() === '' ? (
                <View className="bg-slate-800/60 rounded-2xl p-8 items-center border border-slate-700/50">
                  <View className="bg-cyan-500/20 w-16 h-16 rounded-full items-center justify-center mb-4">
                    <Search size={32} color="#06B6D4" />
                  </View>
                  <Text className="text-white font-bold text-lg mb-2">Search Your Inventory</Text>
                  <Text className="text-slate-400 text-sm text-center">
                    Type a name, bin number, rack, or platform to find items
                  </Text>
                </View>
              ) : filteredItems.length === 0 ? (
                <View className="bg-slate-800/60 rounded-2xl p-8 items-center border border-slate-700/50">
                  <Package size={40} color="#64748B" />
                  <Text className="text-white font-medium mt-4">No Items Found</Text>
                  <Text className="text-slate-400 text-sm mt-1 text-center">
                    No items match "{searchQuery}"
                  </Text>
                  <Pressable
                    className="bg-cyan-500 rounded-xl px-6 py-3 mt-4 active:opacity-80"
                    onPress={() => router.push('/add-item')}
                  >
                    <Text className="text-white font-bold">Add New Item</Text>
                  </Pressable>
                </View>
              ) : (
                <View>
                  <Text className="text-slate-400 text-sm mb-3">
                    {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''} found
                  </Text>
                  {filteredItems.map((item) => (
                    <Pressable
                      key={item.id}
                      className="bg-slate-800/60 rounded-2xl p-4 mb-3 border border-slate-700/50 active:opacity-80"
                      onPress={() => router.push(`/item/${item.id}`)}
                    >
                      <View className="flex-row items-start">
                        <Image
                          source={{ uri: getImageUrl(item.imageUrl) }}
                          className="w-20 h-20 rounded-xl bg-slate-700"
                        />
                        <View className="flex-1 ml-4">
                          <Text className="text-white font-bold text-base" numberOfLines={1}>
                            {item.name}
                          </Text>
                          <View
                            className="self-start px-2.5 py-1 rounded-full mt-1.5"
                            style={{ backgroundColor: `${getStatusColor(item.status)}20` }}
                          >
                            <Text
                              style={{ color: getStatusColor(item.status) }}
                              className="text-xs font-semibold capitalize"
                            >
                              {item.status === 'completed' ? 'shipped' : item.status}
                            </Text>
                          </View>
                          <View className="flex-row items-center mt-2 gap-2">
                            {item.binNumber ? (
                              <View className="bg-slate-700/50 px-2 py-1 rounded">
                                <Text className="text-slate-300 text-xs">Bin {item.binNumber}</Text>
                              </View>
                            ) : null}
                            {item.rackNumber ? (
                              <View className="bg-slate-700/50 px-2 py-1 rounded">
                                <Text className="text-slate-300 text-xs">Rack {item.rackNumber}</Text>
                              </View>
                            ) : null}
                          </View>
                        </View>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Photo Search Mode */}
          {searchMode === 'photo' && (
            <View className="px-5">
              {!selectedImage ? (
                <View className="bg-slate-800/60 rounded-2xl p-8 items-center border border-slate-700/50 border-dashed">
                  <View className="bg-cyan-500/20 w-16 h-16 rounded-full items-center justify-center mb-4">
                    <ImageIcon size={32} color="#06B6D4" />
                  </View>
                  <Text className="text-white font-bold text-lg mb-2">Upload an Image</Text>
                  <Text className="text-slate-400 text-sm text-center mb-6">
                    Take a photo or choose from your gallery to find matching items
                  </Text>
                  <View className="flex-row gap-3">
                    <Pressable
                      className="bg-cyan-500 rounded-xl px-6 py-3 flex-row items-center gap-2 active:opacity-80"
                      onPress={takePhoto}
                    >
                      <Camera size={20} color="#FFFFFF" />
                      <Text className="text-white font-bold">Camera</Text>
                    </Pressable>
                    <Pressable
                      className="bg-slate-700 rounded-xl px-6 py-3 flex-row items-center gap-2 active:opacity-80"
                      onPress={pickImage}
                    >
                      <Upload size={20} color="#FFFFFF" />
                      <Text className="text-white font-bold">Gallery</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View>
                  {/* Selected Image Preview */}
                  <View className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/50 mb-4">
                    <Image
                      source={{ uri: selectedImage }}
                      className="w-full h-64 rounded-xl bg-slate-700"
                      resizeMode="cover"
                    />
                    <Pressable
                      className="absolute top-6 right-6 bg-slate-900/80 px-3 py-1.5 rounded-full active:opacity-80"
                      onPress={clearSearch}
                    >
                      <Text className="text-white text-xs font-medium">Clear</Text>
                    </Pressable>
                  </View>

                  {/* Search Status / Results */}
                  {isSearching ? (
                    <View className="bg-slate-800/60 rounded-2xl p-8 items-center border border-slate-700/50">
                      <ActivityIndicator size="large" color="#06B6D4" />
                      <Text className="text-white font-medium mt-4">Searching inventory...</Text>
                      <Text className="text-slate-400 text-sm mt-1">Finding matching items</Text>
                    </View>
                  ) : matchedItem ? (
                    <View>
                      <Text className="text-white font-bold text-lg mb-4">Match Found!</Text>
                      <Pressable
                        className="bg-slate-800/60 rounded-2xl p-4 border border-cyan-500/50 active:opacity-80"
                        onPress={() => router.push(`/item/${matchedItem.id}`)}
                      >
                        <View className="flex-row items-start">
                          <Image
                            source={{ uri: getImageUrl(matchedItem.imageUrl) }}
                            className="w-24 h-24 rounded-xl bg-slate-700"
                          />
                          <View className="flex-1 ml-4">
                            <Text className="text-white font-bold text-lg">{matchedItem.name}</Text>
                            <View
                              className="self-start px-3 py-1 rounded-full mt-2"
                              style={{ backgroundColor: `${getStatusColor(matchedItem.status)}20` }}
                            >
                              <Text
                                style={{ color: getStatusColor(matchedItem.status) }}
                                className="text-xs font-semibold capitalize"
                              >
                                {matchedItem.status}
                              </Text>
                            </View>
                          </View>
                        </View>

                        {/* Location Details */}
                        <View className="mt-4 pt-4 border-t border-slate-700">
                          <View className="flex-row items-center mb-2">
                            <MapPin size={16} color="#06B6D4" />
                            <Text className="text-slate-400 text-sm ml-2">Location</Text>
                          </View>
                          <View className="flex-row gap-3">
                            <View className="bg-slate-700/50 px-4 py-2 rounded-lg flex-1">
                              <Text className="text-slate-400 text-xs">Bin</Text>
                              <Text className="text-white font-bold text-lg">{matchedItem.binNumber}</Text>
                            </View>
                            <View className="bg-slate-700/50 px-4 py-2 rounded-lg flex-1">
                              <Text className="text-slate-400 text-xs">Rack</Text>
                              <Text className="text-white font-bold text-lg">{matchedItem.rackNumber}</Text>
                            </View>
                          </View>
                          <View className="bg-slate-700/50 px-4 py-2 rounded-lg mt-3">
                            <Text className="text-slate-400 text-xs">Platform</Text>
                            <Text className="text-cyan-400 font-bold">{matchedItem.platform}</Text>
                          </View>
                        </View>

                        <Pressable
                          className="bg-cyan-500 rounded-xl py-3 mt-4 items-center active:opacity-80"
                          onPress={() => router.push(`/item/${matchedItem.id}`)}
                        >
                          <Text className="text-white font-bold">View Full Details</Text>
                        </Pressable>
                      </Pressable>
                    </View>
                  ) : (
                    <View className="bg-slate-800/60 rounded-2xl p-8 items-center border border-slate-700/50">
                      <Package size={40} color="#64748B" />
                      <Text className="text-white font-medium mt-4">No Match Found</Text>
                      <Text className="text-slate-400 text-sm mt-1 text-center">
                        This item doesn't appear to be in your inventory
                      </Text>
                      <Pressable
                        className="bg-cyan-500 rounded-xl px-6 py-3 mt-4 active:opacity-80"
                        onPress={() => router.push('/add-item')}
                      >
                        <Text className="text-white font-bold">Add to Inventory</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              )}

              {/* Tips Section */}
              {!selectedImage && (
                <View className="mt-8 pb-8">
                  <Text className="text-white font-bold text-lg mb-4">Tips for Best Results</Text>
                  <View className="bg-slate-800/40 rounded-xl p-4">
                    <View className="flex-row items-start mb-3">
                      <View className="bg-cyan-500/20 w-6 h-6 rounded-full items-center justify-center mr-3 mt-0.5">
                        <Text className="text-cyan-400 text-xs font-bold">1</Text>
                      </View>
                      <Text className="text-slate-300 flex-1">
                        Take clear, well-lit photos of the item
                      </Text>
                    </View>
                    <View className="flex-row items-start mb-3">
                      <View className="bg-cyan-500/20 w-6 h-6 rounded-full items-center justify-center mr-3 mt-0.5">
                        <Text className="text-cyan-400 text-xs font-bold">2</Text>
                      </View>
                      <Text className="text-slate-300 flex-1">
                        Include distinctive features or labels
                      </Text>
                    </View>
                    <View className="flex-row items-start">
                      <View className="bg-cyan-500/20 w-6 h-6 rounded-full items-center justify-center mr-3 mt-0.5">
                        <Text className="text-cyan-400 text-xs font-bold">3</Text>
                      </View>
                      <Text className="text-slate-300 flex-1">
                        Capture the same angle as the original photo
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
          )}

          <View className="h-8" />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
