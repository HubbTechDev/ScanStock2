import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, Image, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown, FadeInUp, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { X, Download, Check, ChevronRight, Store, AlertCircle, Package, ExternalLink, CheckCircle2, Circle } from 'lucide-react-native';
import { api, BACKEND_URL } from '@/lib/api';
import type { CreateInventoryItemRequest, InventoryItem, ScrapeResponse, ScrapedListing, PlatformType } from '@/shared/contracts';
import * as Haptics from 'expo-haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function ImportListingsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<'input' | 'preview' | 'importing' | 'done'>('input');
  const [platform, setPlatform] = useState<PlatformType | null>(null);
  const [storeUrl, setStoreUrl] = useState('');
  const [listings, setListings] = useState<ScrapedListing[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [storeName, setStoreName] = useState('');
  const [importedCount, setImportedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const scrapeMutation = useMutation({
    mutationFn: async (data: { platform: PlatformType; storeUrl: string }) => {
      const response = await api.post<ScrapeResponse>('/api/import/scrape', data);
      return response;
    },
    onSuccess: (data) => {
      if (data.success && data.listings.length > 0) {
        setListings(data.listings);
        setStoreName(data.storeName);
        // Select all by default
        setSelectedIds(new Set(data.listings.map((l) => l.id)));
        setStep('preview');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setError(data.error || 'No listings found');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    },
    onError: (err) => {
      setError('Failed to fetch listings. Please check the URL and try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const importMutation = useMutation({
    mutationFn: async (listing: ScrapedListing) => {
      const itemData: CreateInventoryItemRequest = {
        name: listing.title,
        description: listing.description || undefined,
        imageUrl: listing.imageUrl,
        platform: platform === 'mercari' ? 'Mercari' : 'Depop',
        status: listing.status === 'sold' ? 'sold' : 'pending',
      };
      return api.post<InventoryItem>('/api/inventory', itemData);
    },
  });

  const handleScrape = () => {
    if (!platform || !storeUrl.trim()) return;
    setError(null);
    scrapeMutation.mutate({ platform, storeUrl: storeUrl.trim() });
  };

  const handleImport = async () => {
    setStep('importing');
    const selectedListings = listings.filter((l) => selectedIds.has(l.id));
    let imported = 0;

    for (const listing of selectedListings) {
      try {
        await importMutation.mutateAsync(listing);
        imported++;
        setImportedCount(imported);
      } catch (err) {
        console.error('Failed to import listing:', listing.title);
      }
    }

    await queryClient.invalidateQueries({ queryKey: ['inventory'] });
    setStep('done');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const toggleSelection = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (selectedIds.size === listings.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(listings.map((l) => l.id)));
    }
  };

  const detectPlatform = (url: string) => {
    if (url.includes('mercari.com')) {
      setPlatform('mercari');
    } else if (url.includes('depop.com')) {
      setPlatform('depop');
    }
  };

  const renderListingItem = ({ item, index }: { item: ScrapedListing; index: number }) => {
    const isSelected = selectedIds.has(item.id);

    return (
      <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
        <Pressable
          className={`flex-row bg-slate-800/60 rounded-2xl p-3 mb-3 border ${
            isSelected ? 'border-cyan-500' : 'border-slate-700/50'
          }`}
          onPress={() => toggleSelection(item.id)}
        >
          <View className="relative">
            <Image
              source={{ uri: item.imageUrl }}
              className="w-20 h-20 rounded-xl bg-slate-700"
              resizeMode="cover"
            />
            <View
              className={`absolute -top-1 -right-1 w-6 h-6 rounded-full items-center justify-center ${
                isSelected ? 'bg-cyan-500' : 'bg-slate-700'
              }`}
            >
              {isSelected ? (
                <Check size={14} color="#FFFFFF" />
              ) : (
                <Circle size={14} color="#64748B" />
              )}
            </View>
            {item.status === 'sold' && (
              <View className="absolute bottom-1 left-1 bg-amber-500/90 px-1.5 py-0.5 rounded">
                <Text className="text-white text-[10px] font-bold">SOLD</Text>
              </View>
            )}
          </View>
          <View className="flex-1 ml-3 justify-center">
            <Text className="text-white font-semibold text-sm" numberOfLines={2}>
              {item.title}
            </Text>
            <Text className="text-cyan-400 font-bold mt-1">{item.price}</Text>
          </View>
        </Pressable>
      </Animated.View>
    );
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
            <X size={20} color="#F8FAFC" />
          </Pressable>
          <Text className="text-white text-lg font-bold">Import Listings</Text>
          <View className="w-10" />
        </View>

        {step === 'input' && (
          <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
            {/* Info Card */}
            <Animated.View
              entering={FadeInDown.delay(100).springify()}
              className="bg-cyan-500/10 rounded-2xl p-4 mb-6 border border-cyan-500/30"
            >
              <View className="flex-row items-center mb-2">
                <Download size={20} color="#06B6D4" />
                <Text className="text-cyan-400 font-bold ml-2">Import from Store</Text>
              </View>
              <Text className="text-slate-300 text-sm leading-5">
                Import your listings from Mercari or Depop automatically. We'll pull in the title,
                price, photos, and description for each item.
              </Text>
            </Animated.View>

            {/* Platform Selection */}
            <Animated.View entering={FadeInDown.delay(150).springify()}>
              <Text className="text-white font-semibold mb-3">Select Platform</Text>
              <View className="flex-row gap-3 mb-6">
                <Pressable
                  className={`flex-1 p-4 rounded-2xl border ${
                    platform === 'mercari'
                      ? 'bg-red-500/20 border-red-500'
                      : 'bg-slate-800/60 border-slate-700/50'
                  }`}
                  onPress={() => {
                    setPlatform('mercari');
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <View className="items-center">
                    <View
                      className={`w-12 h-12 rounded-full items-center justify-center mb-2 ${
                        platform === 'mercari' ? 'bg-red-500' : 'bg-slate-700'
                      }`}
                    >
                      <Text className="text-white text-xl font-bold">M</Text>
                    </View>
                    <Text className="text-white font-semibold">Mercari</Text>
                    <Text className="text-slate-400 text-xs mt-1">mercari.com/u/USERNAME</Text>
                  </View>
                </Pressable>
                <Pressable
                  className={`flex-1 p-4 rounded-2xl border ${
                    platform === 'depop'
                      ? 'bg-emerald-500/20 border-emerald-500'
                      : 'bg-slate-800/60 border-slate-700/50'
                  }`}
                  onPress={() => {
                    setPlatform('depop');
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                >
                  <View className="items-center">
                    <View
                      className={`w-12 h-12 rounded-full items-center justify-center mb-2 ${
                        platform === 'depop' ? 'bg-emerald-500' : 'bg-slate-700'
                      }`}
                    >
                      <Text className="text-white text-xl font-bold">D</Text>
                    </View>
                    <Text className="text-white font-semibold">Depop</Text>
                    <Text className="text-slate-400 text-xs mt-1">depop.com/USERNAME</Text>
                  </View>
                </Pressable>
              </View>
            </Animated.View>

            {/* URL Input */}
            <Animated.View entering={FadeInDown.delay(200).springify()}>
              <Text className="text-white font-semibold mb-2">
                {platform === 'mercari'
                  ? 'Mercari Profile URL or Username'
                  : platform === 'depop'
                  ? 'Depop Shop URL or Username'
                  : 'Store URL or Username'}
              </Text>
              <TextInput
                className="bg-slate-800/60 rounded-xl px-4 py-3.5 text-white border border-slate-700/50 mb-2"
                placeholder={
                  platform === 'mercari'
                    ? 'mercari.com/u/your-username'
                    : platform === 'depop'
                    ? 'depop.com/your-username'
                    : 'Enter your store URL or username'
                }
                placeholderTextColor="#64748B"
                value={storeUrl}
                onChangeText={(text) => {
                  setStoreUrl(text);
                  detectPlatform(text);
                }}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text className="text-slate-500 text-xs mb-6">
                You can paste the full URL or just your username
              </Text>
            </Animated.View>

            {/* Error Message */}
            {error && (
              <Animated.View
                entering={FadeIn}
                className="bg-red-500/20 rounded-xl p-4 mb-4 flex-row items-center border border-red-500/30"
              >
                <AlertCircle size={20} color="#EF4444" />
                <Text className="text-red-400 ml-2 flex-1">{error}</Text>
              </Animated.View>
            )}

            {/* What We Import */}
            <Animated.View entering={FadeInDown.delay(250).springify()} className="mb-8">
              <Text className="text-white font-semibold mb-3">What We'll Import</Text>
              <View className="bg-slate-800/40 rounded-2xl p-4">
                {['Title', 'Price', 'Photos', 'Description', 'Item URL', 'Status (available/sold)'].map(
                  (item, index) => (
                    <View
                      key={item}
                      className={`flex-row items-center py-2 ${
                        index < 5 ? 'border-b border-slate-700/30' : ''
                      }`}
                    >
                      <CheckCircle2 size={16} color="#10B981" />
                      <Text className="text-slate-300 ml-2">{item}</Text>
                    </View>
                  )
                )}
              </View>
            </Animated.View>

            {/* Fetch Button */}
            <Pressable
              className={`rounded-2xl py-4 items-center mb-8 ${
                platform && storeUrl.trim() ? 'bg-cyan-500 active:opacity-80' : 'bg-slate-700'
              }`}
              onPress={handleScrape}
              disabled={!platform || !storeUrl.trim() || scrapeMutation.isPending}
            >
              {scrapeMutation.isPending ? (
                <View className="flex-row items-center">
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text className="text-white font-bold ml-2">Fetching Listings...</Text>
                </View>
              ) : (
                <View className="flex-row items-center">
                  <Download size={20} color={platform && storeUrl.trim() ? '#FFFFFF' : '#64748B'} />
                  <Text
                    className={`font-bold text-base ml-2 ${
                      platform && storeUrl.trim() ? 'text-white' : 'text-slate-500'
                    }`}
                  >
                    Fetch Listings
                  </Text>
                </View>
              )}
            </Pressable>
          </ScrollView>
        )}

        {step === 'preview' && (
          <View className="flex-1">
            {/* Store Info */}
            <Animated.View entering={FadeInDown} className="px-5 pb-4">
              <View className="bg-emerald-500/20 rounded-xl p-3 flex-row items-center border border-emerald-500/30">
                <Store size={20} color="#10B981" />
                <View className="ml-3 flex-1">
                  <Text className="text-emerald-400 font-bold">{storeName}</Text>
                  <Text className="text-slate-400 text-sm">
                    {listings.length} listings found
                  </Text>
                </View>
              </View>
            </Animated.View>

            {/* Select All Row */}
            <View className="px-5 pb-3 flex-row items-center justify-between">
              <Pressable
                className="flex-row items-center active:opacity-80"
                onPress={toggleSelectAll}
              >
                <View
                  className={`w-5 h-5 rounded items-center justify-center mr-2 ${
                    selectedIds.size === listings.length ? 'bg-cyan-500' : 'bg-slate-700'
                  }`}
                >
                  {selectedIds.size === listings.length && <Check size={12} color="#FFFFFF" />}
                </View>
                <Text className="text-white font-medium">Select All</Text>
              </Pressable>
              <Text className="text-slate-400 text-sm">
                {selectedIds.size} of {listings.length} selected
              </Text>
            </View>

            {/* Listings List */}
            <FlatList
              data={listings}
              renderItem={renderListingItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
              showsVerticalScrollIndicator={false}
            />

            {/* Import Button */}
            <View className="px-5 pb-6 pt-2 bg-neutral-900/90">
              <Pressable
                className={`rounded-2xl py-4 items-center ${
                  selectedIds.size > 0 ? 'bg-cyan-500 active:opacity-80' : 'bg-slate-700'
                }`}
                onPress={handleImport}
                disabled={selectedIds.size === 0}
              >
                <View className="flex-row items-center">
                  <Package size={20} color={selectedIds.size > 0 ? '#FFFFFF' : '#64748B'} />
                  <Text
                    className={`font-bold text-base ml-2 ${
                      selectedIds.size > 0 ? 'text-white' : 'text-slate-500'
                    }`}
                  >
                    Import {selectedIds.size} Item{selectedIds.size !== 1 ? 's' : ''}
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>
        )}

        {step === 'importing' && (
          <View className="flex-1 items-center justify-center px-8">
            <Animated.View entering={FadeInUp.springify()} className="items-center">
              <View className="w-20 h-20 rounded-full bg-cyan-500/20 items-center justify-center mb-6">
                <ActivityIndicator size="large" color="#06B6D4" />
              </View>
              <Text className="text-white text-xl font-bold mb-2">Importing Listings</Text>
              <Text className="text-slate-400 text-center">
                {importedCount} of {selectedIds.size} items imported
              </Text>
              <View className="w-full bg-slate-800 rounded-full h-2 mt-4 overflow-hidden">
                <View
                  className="bg-cyan-500 h-full rounded-full"
                  style={{ width: `${(importedCount / selectedIds.size) * 100}%` }}
                />
              </View>
            </Animated.View>
          </View>
        )}

        {step === 'done' && (
          <View className="flex-1 items-center justify-center px-8">
            <Animated.View entering={FadeInUp.springify()} className="items-center">
              <View className="w-20 h-20 rounded-full bg-emerald-500/20 items-center justify-center mb-6">
                <CheckCircle2 size={40} color="#10B981" />
              </View>
              <Text className="text-white text-xl font-bold mb-2">Import Complete!</Text>
              <Text className="text-slate-400 text-center mb-8">
                Successfully imported {importedCount} item{importedCount !== 1 ? 's' : ''} to your inventory
              </Text>
              <Pressable
                className="bg-cyan-500 rounded-2xl py-4 px-8 active:opacity-80"
                onPress={() => router.back()}
              >
                <Text className="text-white font-bold">View Inventory</Text>
              </Pressable>
            </Animated.View>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}
