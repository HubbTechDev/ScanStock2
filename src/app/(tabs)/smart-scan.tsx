import React, { useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  TextInput,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  Upload,
  Check,
  Scan,
  Package,
  Hash,
  Sparkles,
  Plus,
  AlertCircle,
  ShoppingBag,
  UtensilsCrossed,
  Building2,
  ClipboardList,
  ClipboardCheck,
  X,
  Pencil,
} from "lucide-react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
} from "react-native-reanimated";
import { api, BACKEND_URL } from "@/lib/api";
import {
  analyzeInventoryImage,
  countItemsInImage,
  isOpenAIConfigured,
  type DetectedItem,
  type ScanResult,
  type CountScanResult,
  type CountedItem,
} from "@/lib/openai";
import { useStorageLocations } from "@/lib/storage-locations";
import { useIndustryStore, INDUSTRY_CONFIGS } from "@/lib/industry-store";
import type { InventoryItem, UploadImageResponse, GetCycleCountsResponse, CreatePrepItemRequest, PrepUnit } from "@/shared/contracts";

const INDUSTRY_ICONS = {
  retail: ShoppingBag,
  restaurant: UtensilsCrossed,
  hospitality: Building2,
} as const;

type ScanMode = "add" | "count";
type ScanState = "camera" | "scanning" | "results";

export default function SmartScanScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const { locationFields } = useStorageLocations();
  const industry = useIndustryStore((s) => s.industry);
  const config = industry ? INDUSTRY_CONFIGS[industry] : null;
  const accentColor = config?.color ?? '#06B6D4';

  const IndustryIcon = industry ? INDUSTRY_ICONS[industry] : Package;

  const [mode, setMode] = useState<ScanMode>("add");
  const [scanState, setScanState] = useState<ScanState>("camera");
  const [imageUri, setImageUri] = useState<string | null>(null);

  // Add mode state
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [itemLocations, setItemLocations] = useState<Record<number, { bin: string; rack: string }>>({});

  // Count mode state
  const [countQuery, setCountQuery] = useState("");
  const [countResult, setCountResult] = useState<CountScanResult | null>(null);
  const [selectedCountItems, setSelectedCountItems] = useState<Set<number>>(new Set());
  const [editingCountItem, setEditingCountItem] = useState<number | null>(null);
  const [editedDescriptions, setEditedDescriptions] = useState<Record<number, string>>({});
  const [showAddToModal, setShowAddToModal] = useState(false);
  const [addingToPrepSheet, setAddingToPrepSheet] = useState(false);

  const [error, setError] = useState<string | null>(null);

  // Fetch cycle counts for the add-to modal
  const { data: cycleCountsData } = useQuery({
    queryKey: ['cycle-counts'],
    queryFn: () => api.get<GetCycleCountsResponse>('/api/cycle-counts'),
    enabled: showAddToModal,
  });

  const inProgressCycleCounts = cycleCountsData?.cycleCounts?.filter(c => c.status === 'in_progress') ?? [];

  // Mutation for adding items to prep sheet
  const addToPrepSheetMutation = useMutation({
    mutationFn: (items: CreatePrepItemRequest[]) =>
      Promise.all(items.map(item => api.post('/api/prep-items', item))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prep-items'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowAddToModal(false);
      reset();
    },
  });

  // Animation for scanning indicator
  const scanLinePosition = useSharedValue(0);

  const scanLineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanLinePosition.value }],
  }));

  const startScanAnimation = () => {
    scanLinePosition.value = withRepeat(
      withSequence(
        withTiming(200, { duration: 1500 }),
        withTiming(0, { duration: 1500 })
      ),
      -1,
      false
    );
  };

  const takePhoto = async () => {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
    if (photo?.uri) {
      setImageUri(photo.uri);
      handleScan(photo.uri);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      setImageUri(result.assets[0].uri);
      handleScan(result.assets[0].uri);
    }
  };

  const handleScan = async (uri: string) => {
    if (!isOpenAIConfigured()) {
      setError(
        "OpenAI API is not configured. Please go to the API tab in the Vibecode app and set up the OpenAI integration."
      );
      setScanState("results");
      return;
    }

    setScanState("scanning");
    startScanAnimation();
    setError(null);

    try {
      if (mode === "add") {
        const result = await analyzeInventoryImage(uri);
        setScanResult(result);
        // Select all items by default
        setSelectedItems(new Set(result.items.map((_, i) => i)));
      } else {
        const result = await countItemsInImage(uri, countQuery || undefined);
        setCountResult(result);
      }
      setScanState("results");
    } catch (err) {
      console.error("Scan error:", err);
      setError(err instanceof Error ? err.message : "Failed to analyze image");
      setScanState("results");
    }
  };

  const uploadImage = async (uri: string): Promise<string | null> => {
    try {
      const formData = new FormData();
      const filename = uri.split("/").pop() ?? "image.jpg";
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : "image/jpeg";

      formData.append("image", {
        uri,
        name: filename,
        type,
      } as unknown as Blob);

      const response = await fetch(`${BACKEND_URL}/api/upload/image`, {
        method: "POST",
        body: formData,
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const data: UploadImageResponse = await response.json();
      if (data.success) {
        return data.url;
      }
      return null;
    } catch (error) {
      console.error("Upload error:", error);
      return null;
    }
  };

  const addItemMutation = useMutation({
    mutationFn: async (item: DetectedItem & { index: number }) => {
      // Upload the image first
      const uploadedUrl = await uploadImage(imageUri!);
      if (!uploadedUrl) {
        throw new Error("Failed to upload image");
      }

      const location = itemLocations[item.index] ?? { bin: "", rack: "" };
      return api.post<InventoryItem>("/api/inventory", {
        name: item.name,
        description: item.description,
        imageUrl: uploadedUrl,
        binNumber: location.bin || undefined,
        rackNumber: location.rack || undefined,
        status: "pending",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });

  const [addingItems, setAddingItems] = useState(false);
  const [addedCount, setAddedCount] = useState(0);

  const handleAddSelected = async () => {
    if (!scanResult || selectedItems.size === 0) return;

    setAddingItems(true);
    setAddedCount(0);

    const itemsToAdd = Array.from(selectedItems).map((index) => ({
      ...scanResult.items[index],
      index,
    }));

    for (const item of itemsToAdd) {
      try {
        await addItemMutation.mutateAsync(item);
        setAddedCount((prev) => prev + 1);
      } catch (err) {
        console.error("Failed to add item:", item.name, err);
      }
    }

    setAddingItems(false);
    reset();
  };

  const toggleItemSelection = (index: number) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedItems(newSelected);
  };

  const reset = () => {
    setImageUri(null);
    setScanResult(null);
    setCountResult(null);
    setSelectedItems(new Set());
    setSelectedCountItems(new Set());
    setEditingCountItem(null);
    setEditedDescriptions({});
    setItemLocations({});
    setError(null);
    setScanState("camera");
  };

  const enabledFields = locationFields.filter((f) => f.enabled);

  // Camera permission not granted
  if (!permission?.granted && scanState === "camera") {
    return (
      <View className="flex-1 bg-neutral-900">
        <LinearGradient
          colors={["#1C1C1E", "#2C2C2E", "#1C1C1E"]}
          style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
        />
        <SafeAreaView className="flex-1" edges={["top"]}>
          <View className="px-5 pt-4 pb-4 flex-row items-center">
            <IndustryIcon size={28} color={accentColor} />
            <Text className="text-white text-lg font-bold ml-3">SmartScan</Text>
          </View>
          <View className="flex-1 justify-center items-center px-8">
            <Scan size={64} color="#64748B" />
            <Text className="text-white text-lg font-semibold mt-4 text-center">
              Camera Access Required
            </Text>
            <Text className="text-slate-400 text-center mt-2">
              Allow camera access to scan items with AI
            </Text>
            <Pressable
              className="rounded-xl px-8 py-4 mt-6 active:opacity-80"
              style={{ backgroundColor: accentColor }}
              onPress={requestPermission}
            >
              <Text className="text-white font-bold">Grant Permission</Text>
            </Pressable>
            <Pressable className="mt-4 active:opacity-80" onPress={pickImage}>
              <Text className="font-semibold" style={{ color: accentColor }}>Choose from Gallery</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-neutral-900">
      <LinearGradient
        colors={["#1C1C1E", "#2C2C2E", "#1C1C1E"]}
        style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
      />
      <SafeAreaView className="flex-1" edges={["top"]}>
        {/* Header */}
        <View className="px-5 pt-4 pb-4 flex-row items-center justify-between">
          <View className="flex-row items-center">
            <IndustryIcon size={28} color={accentColor} />
            <View className="ml-3">
              <Text className="text-white text-lg font-bold">SmartScan</Text>
              <Text className="text-slate-400 text-xs">
                {mode === "add" ? "Scan & Add Items" : "Count Items"}
              </Text>
            </View>
          </View>
          {scanState === "results" && (
            <Pressable
              className="bg-slate-800 px-4 py-2 rounded-lg active:opacity-80"
              onPress={reset}
            >
              <Text className="font-semibold" style={{ color: accentColor }}>Scan Again</Text>
            </Pressable>
          )}
        </View>

        {/* Mode Toggle */}
        {scanState === "camera" && (
          <View className="px-5 mb-4">
            <View className="bg-slate-800/60 rounded-xl p-1 flex-row border border-slate-700/50">
              <Pressable
                className="flex-1 py-2.5 rounded-lg items-center flex-row justify-center gap-2"
                style={mode === "add" ? { backgroundColor: accentColor } : undefined}
                onPress={() => setMode("add")}
              >
                <Package size={16} color={mode === "add" ? "#FFFFFF" : "#94A3B8"} />
                <Text
                  className={`font-semibold ${mode === "add" ? "text-white" : "text-slate-400"}`}
                >
                  Add Items
                </Text>
              </Pressable>
              <Pressable
                className={`flex-1 py-2.5 rounded-lg items-center flex-row justify-center gap-2 ${
                  mode === "count" ? "bg-violet-500" : ""
                }`}
                onPress={() => setMode("count")}
              >
                <Hash size={16} color={mode === "count" ? "#FFFFFF" : "#94A3B8"} />
                <Text
                  className={`font-semibold ${mode === "count" ? "text-white" : "text-slate-400"}`}
                >
                  Count Items
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Count Mode - Item Query */}
        {scanState === "camera" && mode === "count" && (
          <View className="px-5 mb-4">
            <Text className="text-slate-400 text-sm mb-2">What to count? (optional)</Text>
            <TextInput
              className="bg-slate-800/60 rounded-xl px-4 py-3 text-white border border-slate-700/50"
              placeholder="e.g., 'red shoes' or leave empty for all items"
              placeholderTextColor="#64748B"
              value={countQuery}
              onChangeText={setCountQuery}
            />
          </View>
        )}

        {/* Camera View */}
        {scanState === "camera" && (
          <View className="flex-1 mx-5 rounded-2xl overflow-hidden">
            <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back">
              {/* Scanning overlay */}
              <View
                style={{
                  flex: 1,
                  justifyContent: "flex-end",
                  paddingBottom: 40,
                }}
              >
                {/* Scan frame */}
                <View className="absolute inset-8 border-2 border-cyan-500/50 rounded-xl" />
                <View className="absolute top-8 left-8 w-8 h-8 border-t-4 border-l-4 border-cyan-500 rounded-tl-xl" />
                <View className="absolute top-8 right-8 w-8 h-8 border-t-4 border-r-4 border-cyan-500 rounded-tr-xl" />
                <View className="absolute bottom-8 left-8 w-8 h-8 border-b-4 border-l-4 border-cyan-500 rounded-bl-xl" />
                <View className="absolute bottom-8 right-8 w-8 h-8 border-b-4 border-r-4 border-cyan-500 rounded-br-xl" />

                {/* Controls */}
                <View className="flex-row items-center justify-center gap-6">
                  <Pressable
                    className="w-14 h-14 rounded-full bg-slate-800/80 items-center justify-center active:opacity-80"
                    onPress={pickImage}
                  >
                    <Upload size={24} color="#FFFFFF" />
                  </Pressable>

                  <Pressable
                    className="w-20 h-20 rounded-full bg-white items-center justify-center active:opacity-80"
                    onPress={takePhoto}
                  >
                    <View
                      className="w-16 h-16 rounded-full"
                      style={{ backgroundColor: mode === "add" ? accentColor : "#8B5CF6" }}
                    />
                  </Pressable>

                  <View className="w-14 h-14" />
                </View>
              </View>
            </CameraView>
          </View>
        )}

        {/* Scanning State */}
        {scanState === "scanning" && imageUri && (
          <View className="flex-1 mx-5 rounded-2xl overflow-hidden">
            <Image
              source={{ uri: imageUri }}
              style={{ flex: 1, opacity: 0.7 }}
              resizeMode="cover"
            />
            <View className="absolute inset-0 items-center justify-center">
              <Animated.View
                style={[
                  {
                    position: "absolute",
                    left: 32,
                    right: 32,
                    height: 2,
                    backgroundColor: "#06B6D4",
                    shadowColor: "#06B6D4",
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 1,
                    shadowRadius: 10,
                  },
                  scanLineStyle,
                ]}
              />
              <View className="bg-slate-900/90 rounded-2xl px-6 py-4 items-center">
                <Sparkles size={32} color="#06B6D4" />
                <Text className="text-white font-bold mt-2">Analyzing Image...</Text>
                <Text className="text-slate-400 text-sm mt-1">
                  {mode === "add" ? "Detecting inventory items" : "Counting items"}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Results State */}
        {scanState === "results" && (
          <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
            {/* Error Display */}
            {error && (
              <View className="bg-red-500/20 rounded-2xl p-4 mb-4 flex-row items-start border border-red-500/30">
                <AlertCircle size={24} color="#EF4444" />
                <View className="flex-1 ml-3">
                  <Text className="text-red-400 font-semibold">Scan Failed</Text>
                  <Text className="text-red-300 text-sm mt-1">{error}</Text>
                </View>
              </View>
            )}

            {/* Scanned Image Preview */}
            {imageUri && (
              <View className="mb-4">
                <Image
                  source={{ uri: imageUri }}
                  className="w-full h-48 rounded-2xl bg-slate-800"
                  resizeMode="cover"
                />
              </View>
            )}

            {/* Add Mode Results */}
            {mode === "add" && scanResult && !error && (
              <>
                {/* Summary */}
                <View className="rounded-2xl p-4 mb-4 border" style={{ backgroundColor: `${accentColor}20`, borderColor: `${accentColor}30` }}>
                  <View className="flex-row items-center justify-between">
                    <View>
                      <Text className="font-bold text-lg" style={{ color: accentColor }}>
                        {scanResult.totalCount} Item{scanResult.totalCount !== 1 ? "s" : ""} Detected
                      </Text>
                      <Text className="text-slate-400 text-sm mt-1">{scanResult.summary}</Text>
                    </View>
                    <View className="w-12 h-12 rounded-xl items-center justify-center" style={{ backgroundColor: accentColor }}>
                      <Package size={24} color="#FFFFFF" />
                    </View>
                  </View>
                </View>

                {/* Items List */}
                {scanResult.items.map((item, index) => (
                  <Pressable
                    key={index}
                    className="bg-slate-800/60 rounded-2xl p-4 mb-3 border"
                    style={{ borderColor: selectedItems.has(index) ? accentColor : 'rgba(51, 65, 85, 0.5)' }}
                    onPress={() => toggleItemSelection(index)}
                  >
                    <View className="flex-row items-start">
                      <Pressable
                        className="w-6 h-6 rounded-md items-center justify-center mr-3"
                        style={{ backgroundColor: selectedItems.has(index) ? accentColor : '#334155' }}
                        onPress={() => toggleItemSelection(index)}
                      >
                        {selectedItems.has(index) && <Check size={14} color="#FFFFFF" />}
                      </Pressable>
                      <View className="flex-1">
                        <Text className="text-white font-bold text-base">{item.name}</Text>
                        <Text className="text-slate-400 text-sm mt-1">{item.description}</Text>
                        <View className="flex-row flex-wrap gap-2 mt-2">
                          {item.category && (
                            <View className="bg-slate-700/50 px-2 py-1 rounded">
                              <Text className="text-slate-300 text-xs">{item.category}</Text>
                            </View>
                          )}
                          {item.condition && (
                            <View className="bg-emerald-500/20 px-2 py-1 rounded">
                              <Text className="text-emerald-400 text-xs">{item.condition}</Text>
                            </View>
                          )}
                          {item.estimatedValue && (
                            <View className="bg-amber-500/20 px-2 py-1 rounded">
                              <Text className="text-amber-400 text-xs">{item.estimatedValue}</Text>
                            </View>
                          )}
                        </View>

                        {/* Location inputs when selected */}
                        {selectedItems.has(index) && enabledFields.length > 0 && (
                          <View className="flex-row gap-2 mt-3">
                            {enabledFields.slice(0, 2).map((field) => (
                              <TextInput
                                key={field.id}
                                className="flex-1 bg-slate-700/50 rounded-lg px-3 py-2 text-white text-sm"
                                placeholder={field.placeholder}
                                placeholderTextColor="#64748B"
                                value={
                                  itemLocations[index]?.[field.id === "bin" ? "bin" : "rack"] ?? ""
                                }
                                onChangeText={(text) =>
                                  setItemLocations((prev) => ({
                                    ...prev,
                                    [index]: {
                                      ...prev[index],
                                      [field.id === "bin" ? "bin" : "rack"]: text,
                                    },
                                  }))
                                }
                              />
                            ))}
                          </View>
                        )}
                      </View>
                    </View>
                  </Pressable>
                ))}

                {/* Add Selected Button */}
                <Pressable
                  className="rounded-2xl py-4 items-center mb-8"
                  style={{
                    backgroundColor: selectedItems.size > 0 && !addingItems ? accentColor : '#334155',
                    opacity: selectedItems.size === 0 || addingItems ? 0.7 : 1,
                  }}
                  onPress={handleAddSelected}
                  disabled={selectedItems.size === 0 || addingItems}
                >
                  {addingItems ? (
                    <View className="flex-row items-center">
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text className="text-white font-bold ml-2">
                        Adding {addedCount}/{selectedItems.size}...
                      </Text>
                    </View>
                  ) : (
                    <View className="flex-row items-center">
                      <Plus size={20} color={selectedItems.size > 0 ? "#FFFFFF" : "#64748B"} />
                      <Text
                        className={`font-bold text-base ml-2 ${
                          selectedItems.size > 0 ? "text-white" : "text-slate-500"
                        }`}
                      >
                        Add {selectedItems.size} Item{selectedItems.size !== 1 ? "s" : ""} to
                        Inventory
                      </Text>
                    </View>
                  )}
                </Pressable>
              </>
            )}

            {/* Count Mode Results */}
            {mode === "count" && countResult && !error && (
              <>
                {/* Summary */}
                <View className="bg-violet-500/20 rounded-2xl p-4 mb-4 border border-violet-500/30">
                  <View className="flex-row items-center justify-between">
                    <View>
                      <Text className="text-violet-300 text-sm">
                        {countQuery ? `Count of "${countQuery}"` : "Total Items"}
                      </Text>
                      <Text className="text-white font-bold text-4xl mt-1">{countResult.totalCount}</Text>
                      <Text className="text-slate-400 text-sm mt-1">{countResult.summary}</Text>
                    </View>
                    <View className="w-14 h-14 rounded-xl bg-violet-500 items-center justify-center">
                      <Hash size={28} color="#FFFFFF" />
                    </View>
                  </View>
                </View>

                {/* Individual Items List */}
                <Text className="text-white font-bold text-lg mb-3">Items Found</Text>
                {countResult.items.map((item, index) => (
                  <Pressable
                    key={index}
                    className="bg-slate-800/60 rounded-2xl p-4 mb-3 border"
                    style={{ borderColor: selectedCountItems.has(index) ? '#8B5CF6' : 'rgba(51, 65, 85, 0.5)' }}
                    onPress={() => {
                      const newSelected = new Set(selectedCountItems);
                      if (newSelected.has(index)) {
                        newSelected.delete(index);
                      } else {
                        newSelected.add(index);
                      }
                      setSelectedCountItems(newSelected);
                    }}
                  >
                    <View className="flex-row items-start">
                      <Pressable
                        className="w-6 h-6 rounded-md items-center justify-center mr-3"
                        style={{ backgroundColor: selectedCountItems.has(index) ? '#8B5CF6' : '#334155' }}
                        onPress={() => {
                          const newSelected = new Set(selectedCountItems);
                          if (newSelected.has(index)) {
                            newSelected.delete(index);
                          } else {
                            newSelected.add(index);
                          }
                          setSelectedCountItems(newSelected);
                        }}
                      >
                        {selectedCountItems.has(index) && <Check size={14} color="#FFFFFF" />}
                      </Pressable>
                      <View className="flex-1">
                        <View className="flex-row items-center gap-2 mb-1">
                          <Text className="text-white font-bold text-base">{item.name}</Text>
                          <View className="bg-violet-500/30 px-2 py-0.5 rounded">
                            <Text className="text-violet-300 text-xs font-bold">×{item.quantity}</Text>
                          </View>
                        </View>

                        {editingCountItem === index ? (
                          <TextInput
                            className="bg-slate-700/50 rounded-lg px-3 py-2 text-white text-sm mt-2"
                            value={editedDescriptions[index] ?? item.description}
                            onChangeText={(text) =>
                              setEditedDescriptions((prev) => ({ ...prev, [index]: text }))
                            }
                            multiline
                            autoFocus
                            onBlur={() => setEditingCountItem(null)}
                            placeholderTextColor="#64748B"
                          />
                        ) : (
                          <Pressable onPress={() => setEditingCountItem(index)}>
                            <Text className="text-slate-400 text-sm mt-1">
                              {editedDescriptions[index] ?? item.description}
                            </Text>
                            <View className="flex-row items-center mt-1">
                              <Pencil size={10} color="#8B5CF6" />
                              <Text className="text-violet-400 text-xs ml-1">Tap to edit</Text>
                            </View>
                          </Pressable>
                        )}

                        {item.category && (
                          <View className="flex-row mt-2">
                            <View className="bg-slate-700/50 px-2 py-1 rounded">
                              <Text className="text-slate-300 text-xs">{item.category}</Text>
                            </View>
                          </View>
                        )}
                      </View>
                    </View>
                  </Pressable>
                ))}

                {/* Add To Button */}
                {countResult.items.length > 0 && (
                  <Pressable
                    className="rounded-2xl py-4 items-center mb-4 flex-row justify-center"
                    style={{
                      backgroundColor: selectedCountItems.size > 0 ? '#8B5CF6' : '#334155',
                      opacity: selectedCountItems.size === 0 ? 0.7 : 1,
                    }}
                    onPress={() => {
                      if (selectedCountItems.size > 0) {
                        setShowAddToModal(true);
                      }
                    }}
                    disabled={selectedCountItems.size === 0}
                  >
                    <Plus size={20} color={selectedCountItems.size > 0 ? "#FFFFFF" : "#64748B"} />
                    <Text
                      className={`font-bold text-base ml-2 ${
                        selectedCountItems.size > 0 ? "text-white" : "text-slate-500"
                      }`}
                    >
                      Add {selectedCountItems.size} Item{selectedCountItems.size !== 1 ? "s" : ""} To...
                    </Text>
                  </Pressable>
                )}

                <View className="h-4" />
              </>
            )}

            {/* No Results */}
            {!error &&
              ((mode === "add" && scanResult?.items.length === 0) ||
                (mode === "count" && countResult?.totalCount === 0)) && (
                <View className="bg-slate-800/60 rounded-2xl p-8 items-center border border-slate-700/50">
                  <Package size={40} color="#64748B" />
                  <Text className="text-slate-400 mt-3 text-center">
                    No items detected in this image
                  </Text>
                  <Pressable
                    className="rounded-xl px-6 py-3 mt-4 active:opacity-80"
                    style={{ backgroundColor: accentColor }}
                    onPress={reset}
                  >
                    <Text className="text-white font-bold">Try Another Photo</Text>
                  </Pressable>
                </View>
              )}

            <View className="h-8" />
          </ScrollView>
        )}

        {/* Bottom hint for camera mode */}
        {scanState === "camera" && (
          <View className="px-5 pb-6">
            <Text className="text-slate-500 text-center text-sm">
              {mode === "add"
                ? "Point camera at items to scan and add to inventory"
                : "Point camera at items to count them"}
            </Text>
          </View>
        )}
      </SafeAreaView>

      {/* Add To Modal */}
      <Modal visible={showAddToModal} transparent animationType="fade">
        <Pressable
          className="flex-1 bg-black/60 justify-end"
          onPress={() => setShowAddToModal(false)}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View className="bg-slate-800 rounded-t-3xl">
              {/* Header */}
              <View className="p-5 border-b border-slate-700 flex-row items-center justify-between">
                <Text className="text-white font-bold text-lg">Add Items To...</Text>
                <Pressable onPress={() => setShowAddToModal(false)}>
                  <X size={24} color="#94A3B8" />
                </Pressable>
              </View>

              <View className="p-5">
                {/* Cycle Count Option */}
                <Text className="text-slate-400 text-sm mb-2 font-medium">Cycle Count</Text>
                {inProgressCycleCounts.length > 0 ? (
                  inProgressCycleCounts.map((count) => (
                    <Pressable
                      key={count.id}
                      className="bg-slate-700/50 rounded-xl p-4 mb-2 flex-row items-center justify-between active:opacity-80"
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        setShowAddToModal(false);
                        router.push(`/cycle-count?id=${count.id}`);
                      }}
                    >
                      <View className="flex-row items-center">
                        <ClipboardCheck size={20} color="#8B5CF6" />
                        <View className="ml-3">
                          <Text className="text-white font-semibold">{count.name}</Text>
                          <Text className="text-slate-400 text-xs">
                            {count.countedItems ?? 0}/{count.totalItems ?? 0} items counted
                          </Text>
                        </View>
                      </View>
                      <Text className="text-violet-400 text-sm">Go →</Text>
                    </Pressable>
                  ))
                ) : (
                  <Pressable
                    className="bg-slate-700/50 rounded-xl p-4 mb-2 flex-row items-center active:opacity-80"
                    onPress={() => {
                      setShowAddToModal(false);
                      router.push('/cycle-counts');
                    }}
                  >
                    <Plus size={20} color="#64748B" />
                    <Text className="text-slate-400 ml-3">Create a new cycle count first</Text>
                  </Pressable>
                )}

                {/* Prep Sheet Option (Restaurant only) */}
                {industry === 'restaurant' && (
                  <>
                    <Text className="text-slate-400 text-sm mb-2 mt-4 font-medium">Prep Sheet</Text>
                    <Pressable
                      className="bg-amber-500/20 rounded-xl p-4 flex-row items-center justify-between active:opacity-80"
                      style={{ opacity: addingToPrepSheet ? 0.7 : 1 }}
                      disabled={addingToPrepSheet}
                      onPress={() => {
                        if (!countResult) return;
                        setAddingToPrepSheet(true);

                        const itemsToAdd: CreatePrepItemRequest[] = Array.from(selectedCountItems).map((index) => {
                          const item = countResult.items[index];
                          return {
                            name: item.name,
                            category: item.category ?? 'Other',
                            itemType: 'prepped' as const,
                            parLevel: item.quantity,
                            currentLevel: 0,
                            unit: 'each' as PrepUnit,
                            notes: editedDescriptions[index] ?? item.description,
                          };
                        });

                        addToPrepSheetMutation.mutate(itemsToAdd, {
                          onSettled: () => setAddingToPrepSheet(false),
                        });
                      }}
                    >
                      <View className="flex-row items-center">
                        <ClipboardList size={20} color="#F59E0B" />
                        <View className="ml-3">
                          <Text className="text-amber-400 font-semibold">Add to Prep Sheet</Text>
                          <Text className="text-slate-400 text-xs">
                            Add {selectedCountItems.size} items as prep items
                          </Text>
                        </View>
                      </View>
                      {addingToPrepSheet ? (
                        <ActivityIndicator size="small" color="#F59E0B" />
                      ) : (
                        <Plus size={20} color="#F59E0B" />
                      )}
                    </Pressable>
                  </>
                )}

                <View className="h-6" />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
