import React, { useState, useCallback, useRef } from 'react';
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
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ClipboardList,
  Plus,
  Minus,
  Check,
  X,
  ChevronDown,
  AlertTriangle,
  Package,
  Filter,
  Search,
  Scan,
  Carrot,
  ChefHat,
  Upload,
  Sparkles,
} from 'lucide-react-native';
// Note: Carrot and ChefHat are used in AddItemModal for item type toggle
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { api } from '@/lib/api';
import { useIndustryStore, INDUSTRY_CONFIGS } from '@/lib/industry-store';
import { analyzePrepImage, isOpenAIConfigured, type DetectedPrepItem } from '@/lib/openai';
import type {
  GetPrepItemsResponse,
  PrepItem,
  CreatePrepItemRequest,
  PrepUnit,
  PrepItemType,
} from '@/shared/contracts';

// Standard restaurant measurement units
const MEASUREMENT_UNITS: { value: PrepUnit; label: string; shortLabel: string }[] = [
  { value: 'each', label: 'Each', shortLabel: 'ea' },
  { value: 'pint', label: 'Pint', shortLabel: 'pt' },
  { value: 'quart', label: 'Quart', shortLabel: 'qt' },
  { value: 'gallon', label: 'Gallon', shortLabel: 'gal' },
  { value: 'pan', label: 'Full Pan', shortLabel: 'pan' },
  { value: 'half_pan', label: 'Half Pan', shortLabel: '½ pan' },
  { value: 'third_pan', label: 'Third Pan', shortLabel: '⅓ pan' },
  { value: 'sixth_pan', label: 'Sixth Pan', shortLabel: '⅙ pan' },
  { value: 'lb', label: 'Pound', shortLabel: 'lb' },
  { value: 'oz', label: 'Ounce', shortLabel: 'oz' },
  { value: 'kg', label: 'Kilogram', shortLabel: 'kg' },
  { value: 'g', label: 'Gram', shortLabel: 'g' },
  { value: 'cup', label: 'Cup', shortLabel: 'cup' },
  { value: 'tbsp', label: 'Tablespoon', shortLabel: 'tbsp' },
  { value: 'tsp', label: 'Teaspoon', shortLabel: 'tsp' },
  { value: 'dozen', label: 'Dozen', shortLabel: 'dz' },
  { value: 'case', label: 'Case', shortLabel: 'cs' },
  { value: 'bag', label: 'Bag', shortLabel: 'bag' },
  { value: 'box', label: 'Box', shortLabel: 'box' },
  { value: 'bottle', label: 'Bottle', shortLabel: 'btl' },
  { value: 'bunch', label: 'Bunch', shortLabel: 'bnch' },
  { value: 'head', label: 'Head', shortLabel: 'hd' },
  { value: 'slice', label: 'Slice', shortLabel: 'sl' },
  { value: 'portion', label: 'Portion', shortLabel: 'ptn' },
];

const PREP_CATEGORIES = [
  'Produce',
  'Meat & Poultry',
  'Seafood',
  'Dairy',
  'Dry Goods',
  'Sauces & Dressings',
  'Baked Goods',
  'Desserts',
  'Beverages',
  'Mise en Place',
  'Other',
];

const getUnitLabel = (unit: PrepUnit) => {
  return MEASUREMENT_UNITS.find((u) => u.value === unit)?.shortLabel ?? unit;
};

interface PrepItemCardProps {
  item: PrepItem;
  accentColor: string;
  onUpdateLevel: (id: string, newLevel: number) => void;
  onLogPrep: (id: string, quantity: number) => void;
  index: number;
}

function PrepItemCard({ item, accentColor, onUpdateLevel, onLogPrep, index }: PrepItemCardProps) {
  const needsPrep = item.currentLevel < item.parLevel;
  const prepNeeded = Math.max(0, item.parLevel - item.currentLevel);
  const percentFull = Math.min(100, (item.currentLevel / item.parLevel) * 100);

  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handleQuickPrep = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    scale.value = withSpring(0.95, {}, () => {
      scale.value = withSpring(1);
    });
    onLogPrep(item.id, prepNeeded);
  }, [item.id, prepNeeded, onLogPrep, scale]);

  const handleIncrement = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onUpdateLevel(item.id, item.currentLevel + 1);
  }, [item.id, item.currentLevel, onUpdateLevel]);

  const handleDecrement = useCallback(() => {
    if (item.currentLevel > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onUpdateLevel(item.id, item.currentLevel - 1);
    }
  }, [item.id, item.currentLevel, onUpdateLevel]);

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50).springify()}
      style={animatedStyle}
    >
      <View
        className="bg-slate-800/70 rounded-2xl p-4 mb-3 border"
        style={{
          borderColor: needsPrep ? '#F59E0B30' : '#33415530',
        }}
      >
        {/* Header */}
        <View className="flex-row items-start justify-between mb-3">
          <View className="flex-1">
            <Text className="text-white font-bold text-base">{item.name}</Text>
            <Text className="text-slate-400 text-xs mt-0.5">{item.category}</Text>
          </View>
          {needsPrep && (
            <View className="bg-amber-500/20 px-2 py-1 rounded-lg flex-row items-center">
              <AlertTriangle size={12} color="#F59E0B" />
              <Text className="text-amber-400 text-xs font-semibold ml-1">Needs Prep</Text>
            </View>
          )}
        </View>

        {/* Progress Bar */}
        <View className="bg-slate-700/50 h-2 rounded-full overflow-hidden mb-3">
          <View
            className="h-full rounded-full"
            style={{
              width: `${percentFull}%`,
              backgroundColor: needsPrep ? '#F59E0B' : '#10B981',
            }}
          />
        </View>

        {/* Levels */}
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center">
            <Text className="text-slate-400 text-sm">Current: </Text>
            <Text className="text-white font-bold text-sm">
              {item.currentLevel} {getUnitLabel(item.unit as PrepUnit)}
            </Text>
          </View>
          <View className="flex-row items-center">
            <Text className="text-slate-400 text-sm">Par: </Text>
            <Text className="text-white font-bold text-sm">
              {item.parLevel} {getUnitLabel(item.unit as PrepUnit)}
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View className="flex-row items-center gap-2">
          {/* Quantity Controls */}
          <View className="flex-row items-center bg-slate-700/50 rounded-xl">
            <Pressable
              className="w-10 h-10 items-center justify-center active:opacity-70"
              onPress={handleDecrement}
            >
              <Minus size={18} color="#94A3B8" />
            </Pressable>
            <View className="px-2">
              <Text className="text-white font-bold text-sm">{item.currentLevel}</Text>
            </View>
            <Pressable
              className="w-10 h-10 items-center justify-center active:opacity-70"
              onPress={handleIncrement}
            >
              <Plus size={18} color="#94A3B8" />
            </Pressable>
          </View>

          {/* Quick Prep Button */}
          {needsPrep && (
            <Pressable
              className="flex-1 h-10 rounded-xl items-center justify-center flex-row active:opacity-80"
              style={{ backgroundColor: accentColor }}
              onPress={handleQuickPrep}
            >
              <Check size={16} color="#FFFFFF" />
              <Text className="text-white font-bold text-sm ml-1">
                Prep {prepNeeded} {getUnitLabel(item.unit as PrepUnit)}
              </Text>
            </Pressable>
          )}

          {!needsPrep && (
            <View className="flex-1 h-10 rounded-xl items-center justify-center flex-row bg-emerald-500/20">
              <Check size={16} color="#10B981" />
              <Text className="text-emerald-400 font-bold text-sm ml-1">At Par</Text>
            </View>
          )}
        </View>

        {/* Notes */}
        {item.notes && (
          <Text className="text-slate-500 text-xs mt-2 italic">{item.notes}</Text>
        )}
      </View>
    </Animated.View>
  );
}

interface AddItemModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (item: CreatePrepItemRequest) => void;
  accentColor: string;
  defaultItemType?: PrepItemType;
}

function AddItemModal({ visible, onClose, onAdd, accentColor, defaultItemType = 'ingredient' }: AddItemModalProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Produce');
  const [itemType, setItemType] = useState<PrepItemType>(defaultItemType);
  const [parLevel, setParLevel] = useState('');
  const [currentLevel, setCurrentLevel] = useState('');
  const [unit, setUnit] = useState<PrepUnit>('each');
  const [notes, setNotes] = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showUnitPicker, setShowUnitPicker] = useState(false);

  React.useEffect(() => {
    setItemType(defaultItemType);
  }, [defaultItemType]);

  const handleSubmit = () => {
    if (!name.trim() || !parLevel) {
      Alert.alert('Missing Fields', 'Please enter a name and par level');
      return;
    }

    onAdd({
      name: name.trim(),
      category,
      itemType,
      parLevel: parseFloat(parLevel) || 0,
      currentLevel: parseFloat(currentLevel) || 0,
      unit,
      notes: notes.trim() || undefined,
    });

    // Reset form
    setName('');
    setCategory('Produce');
    setParLevel('');
    setCurrentLevel('');
    setUnit('each');
    setNotes('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View className="flex-1 bg-neutral-900">
        <SafeAreaView className="flex-1">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1"
          >
            {/* Header */}
            <View className="px-5 py-4 flex-row items-center justify-between border-b border-slate-800">
              <Pressable onPress={onClose} className="w-10 h-10 items-center justify-center">
                <X size={24} color="#94A3B8" />
              </Pressable>
              <Text className="text-white text-lg font-bold">
                Add {itemType === 'ingredient' ? 'Ingredient' : 'Prepped Item'}
              </Text>
              <Pressable
                onPress={handleSubmit}
                className="px-4 py-2 rounded-lg active:opacity-80"
                style={{ backgroundColor: accentColor }}
              >
                <Text className="text-white font-bold">Add</Text>
              </Pressable>
            </View>

            <ScrollView className="flex-1 px-5 pt-4">
              {/* Item Type Toggle */}
              <View className="mb-4">
                <Text className="text-slate-400 text-sm mb-2 font-medium">Item Type</Text>
                <View className="bg-slate-800 rounded-xl p-1 flex-row">
                  <Pressable
                    className="flex-1 py-2.5 rounded-lg items-center flex-row justify-center gap-2"
                    style={itemType === 'ingredient' ? { backgroundColor: accentColor } : undefined}
                    onPress={() => setItemType('ingredient')}
                  >
                    <Carrot size={16} color={itemType === 'ingredient' ? '#FFFFFF' : '#94A3B8'} />
                    <Text className={itemType === 'ingredient' ? 'text-white font-semibold' : 'text-slate-400'}>
                      Ingredient
                    </Text>
                  </Pressable>
                  <Pressable
                    className="flex-1 py-2.5 rounded-lg items-center flex-row justify-center gap-2"
                    style={itemType === 'prepped' ? { backgroundColor: accentColor } : undefined}
                    onPress={() => setItemType('prepped')}
                  >
                    <ChefHat size={16} color={itemType === 'prepped' ? '#FFFFFF' : '#94A3B8'} />
                    <Text className={itemType === 'prepped' ? 'text-white font-semibold' : 'text-slate-400'}>
                      Prepped
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Name */}
              <View className="mb-4">
                <Text className="text-slate-400 text-sm mb-2 font-medium">Item Name</Text>
                <TextInput
                  className="bg-slate-800 rounded-xl px-4 py-3.5 text-white"
                  placeholder={itemType === 'ingredient' ? 'e.g., Yellow Onions' : 'e.g., Diced Onions'}
                  placeholderTextColor="#64748B"
                  value={name}
                  onChangeText={setName}
                />
              </View>

              {/* Category */}
              <View className="mb-4">
                <Text className="text-slate-400 text-sm mb-2 font-medium">Category</Text>
                <Pressable
                  className="bg-slate-800 rounded-xl px-4 py-3.5 flex-row items-center justify-between"
                  onPress={() => setShowCategoryPicker(true)}
                >
                  <Text className="text-white">{category}</Text>
                  <ChevronDown size={20} color="#64748B" />
                </Pressable>
              </View>

              {/* Par Level & Unit */}
              <View className="flex-row gap-3 mb-4">
                <View className="flex-1">
                  <Text className="text-slate-400 text-sm mb-2 font-medium">Par Level</Text>
                  <TextInput
                    className="bg-slate-800 rounded-xl px-4 py-3.5 text-white"
                    placeholder="0"
                    placeholderTextColor="#64748B"
                    keyboardType="decimal-pad"
                    value={parLevel}
                    onChangeText={setParLevel}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-slate-400 text-sm mb-2 font-medium">Unit</Text>
                  <Pressable
                    className="bg-slate-800 rounded-xl px-4 py-3.5 flex-row items-center justify-between"
                    onPress={() => setShowUnitPicker(true)}
                  >
                    <Text className="text-white">
                      {MEASUREMENT_UNITS.find((u) => u.value === unit)?.label}
                    </Text>
                    <ChevronDown size={20} color="#64748B" />
                  </Pressable>
                </View>
              </View>

              {/* Current Level */}
              <View className="mb-4">
                <Text className="text-slate-400 text-sm mb-2 font-medium">
                  Current Level (optional)
                </Text>
                <TextInput
                  className="bg-slate-800 rounded-xl px-4 py-3.5 text-white"
                  placeholder="0"
                  placeholderTextColor="#64748B"
                  keyboardType="decimal-pad"
                  value={currentLevel}
                  onChangeText={setCurrentLevel}
                />
              </View>

              {/* Notes */}
              <View className="mb-6">
                <Text className="text-slate-400 text-sm mb-2 font-medium">Notes (optional)</Text>
                <TextInput
                  className="bg-slate-800 rounded-xl px-4 py-3.5 text-white"
                  placeholder="Special instructions..."
                  placeholderTextColor="#64748B"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  value={notes}
                  onChangeText={setNotes}
                  style={{ minHeight: 80 }}
                />
              </View>
            </ScrollView>

            {/* Category Picker Modal */}
            <Modal visible={showCategoryPicker} transparent animationType="fade">
              <Pressable
                className="flex-1 bg-black/60 justify-end"
                onPress={() => setShowCategoryPicker(false)}
              >
                <View className="bg-slate-800 rounded-t-3xl max-h-[60%]">
                  <View className="p-4 border-b border-slate-700">
                    <Text className="text-white font-bold text-lg text-center">
                      Select Category
                    </Text>
                  </View>
                  <ScrollView className="p-4">
                    {PREP_CATEGORIES.map((cat) => (
                      <Pressable
                        key={cat}
                        className="py-3 px-4 rounded-xl mb-1"
                        style={category === cat ? { backgroundColor: `${accentColor}20` } : {}}
                        onPress={() => {
                          setCategory(cat);
                          setShowCategoryPicker(false);
                        }}
                      >
                        <Text
                          className={`text-base ${category === cat ? 'font-bold' : ''}`}
                          style={{ color: category === cat ? accentColor : '#F8FAFC' }}
                        >
                          {cat}
                        </Text>
                      </Pressable>
                    ))}
                    <View className="h-8" />
                  </ScrollView>
                </View>
              </Pressable>
            </Modal>

            {/* Unit Picker Modal */}
            <Modal visible={showUnitPicker} transparent animationType="fade">
              <Pressable
                className="flex-1 bg-black/60 justify-end"
                onPress={() => setShowUnitPicker(false)}
              >
                <View className="bg-slate-800 rounded-t-3xl max-h-[60%]">
                  <View className="p-4 border-b border-slate-700">
                    <Text className="text-white font-bold text-lg text-center">Select Unit</Text>
                  </View>
                  <ScrollView className="p-4">
                    {MEASUREMENT_UNITS.map((u) => (
                      <Pressable
                        key={u.value}
                        className="py-3 px-4 rounded-xl mb-1 flex-row justify-between items-center"
                        style={unit === u.value ? { backgroundColor: `${accentColor}20` } : {}}
                        onPress={() => {
                          setUnit(u.value);
                          setShowUnitPicker(false);
                        }}
                      >
                        <Text
                          className={`text-base ${unit === u.value ? 'font-bold' : ''}`}
                          style={{ color: unit === u.value ? accentColor : '#F8FAFC' }}
                        >
                          {u.label}
                        </Text>
                        <Text className="text-slate-500 text-sm">{u.shortLabel}</Text>
                      </Pressable>
                    ))}
                    <View className="h-8" />
                  </ScrollView>
                </View>
              </Pressable>
            </Modal>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// SmartScan Modal for Prep Items
interface SmartScanModalProps {
  visible: boolean;
  onClose: () => void;
  onAddItems: (items: CreatePrepItemRequest[]) => void;
  accentColor: string;
  defaultItemType: PrepItemType;
}

function SmartScanModal({ visible, onClose, onAddItems, accentColor, defaultItemType }: SmartScanModalProps) {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanState, setScanState] = useState<'camera' | 'scanning' | 'results'>('camera');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<DetectedPrepItem[] | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

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
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      setImageUri(result.assets[0].uri);
      handleScan(result.assets[0].uri);
    }
  };

  const handleScan = async (uri: string) => {
    if (!isOpenAIConfigured()) {
      setError('OpenAI API is not configured. Please go to the API tab in the Vibecode app and set up the OpenAI integration.');
      setScanState('results');
      return;
    }

    setScanState('scanning');
    startScanAnimation();
    setError(null);

    try {
      const result = await analyzePrepImage(uri);
      setScanResult(result.items);
      setSelectedItems(new Set(result.items.map((_, i) => i)));
      setScanState('results');
    } catch (err) {
      console.error('Scan error:', err);
      setError(err instanceof Error ? err.message : 'Failed to analyze image');
      setScanState('results');
    }
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

  const handleAddSelected = () => {
    if (!scanResult || selectedItems.size === 0) return;

    const itemsToAdd: CreatePrepItemRequest[] = Array.from(selectedItems).map((index) => {
      const item = scanResult[index];
      return {
        name: item.name,
        category: item.category,
        itemType: defaultItemType,
        parLevel: item.suggestedParLevel,
        currentLevel: 0,
        unit: item.suggestedUnit as PrepUnit,
        notes: item.notes,
      };
    });

    onAddItems(itemsToAdd);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    reset();
    onClose();
  };

  const reset = () => {
    setImageUri(null);
    setScanResult(null);
    setSelectedItems(new Set());
    setError(null);
    setScanState('camera');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View className="flex-1 bg-neutral-900">
        <SafeAreaView className="flex-1">
          {/* Header */}
          <View className="px-5 py-4 flex-row items-center justify-between border-b border-slate-800">
            <Pressable onPress={handleClose} className="w-10 h-10 items-center justify-center">
              <X size={24} color="#94A3B8" />
            </Pressable>
            <View className="items-center">
              <Text className="text-white text-lg font-bold">SmartScan</Text>
              <Text className="text-slate-400 text-xs">
                Scan {defaultItemType === 'ingredient' ? 'Ingredients' : 'Prepped Items'}
              </Text>
            </View>
            {scanState === 'results' && !error && (
              <Pressable onPress={reset} className="px-3 py-1.5 rounded-lg bg-slate-800">
                <Text style={{ color: accentColor }} className="font-semibold text-sm">Rescan</Text>
              </Pressable>
            )}
            {scanState !== 'results' && <View className="w-10" />}
          </View>

          {/* Camera Permission Request */}
          {!permission?.granted && scanState === 'camera' && (
            <View className="flex-1 justify-center items-center px-8">
              <Scan size={64} color="#64748B" />
              <Text className="text-white text-lg font-semibold mt-4 text-center">
                Camera Access Required
              </Text>
              <Text className="text-slate-400 text-center mt-2">
                Allow camera access to scan prep items with AI
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
          )}

          {/* Camera View */}
          {permission?.granted && scanState === 'camera' && (
            <View className="flex-1 m-5 rounded-2xl overflow-hidden">
              <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back">
                <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: 40 }}>
                  {/* Scan frame */}
                  <View className="absolute inset-8 border-2 border-amber-500/50 rounded-xl" />
                  <View className="absolute top-8 left-8 w-8 h-8 border-t-4 border-l-4 border-amber-500 rounded-tl-xl" />
                  <View className="absolute top-8 right-8 w-8 h-8 border-t-4 border-r-4 border-amber-500 rounded-tr-xl" />
                  <View className="absolute bottom-8 left-8 w-8 h-8 border-b-4 border-l-4 border-amber-500 rounded-bl-xl" />
                  <View className="absolute bottom-8 right-8 w-8 h-8 border-b-4 border-r-4 border-amber-500 rounded-br-xl" />

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
                      <View className="w-16 h-16 rounded-full" style={{ backgroundColor: accentColor }} />
                    </Pressable>

                    <View className="w-14 h-14" />
                  </View>
                </View>
              </CameraView>
            </View>
          )}

          {/* Scanning State */}
          {scanState === 'scanning' && imageUri && (
            <View className="flex-1 m-5 rounded-2xl overflow-hidden">
              <Image source={{ uri: imageUri }} style={{ flex: 1, opacity: 0.7 }} resizeMode="cover" />
              <View className="absolute inset-0 items-center justify-center">
                <Animated.View
                  style={[
                    {
                      position: 'absolute',
                      left: 32,
                      right: 32,
                      height: 2,
                      backgroundColor: '#F59E0B',
                      shadowColor: '#F59E0B',
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 1,
                      shadowRadius: 10,
                    },
                    scanLineStyle,
                  ]}
                />
                <View className="bg-slate-900/90 rounded-2xl px-6 py-4 items-center">
                  <Sparkles size={32} color="#F59E0B" />
                  <Text className="text-white font-bold mt-2">Analyzing Image...</Text>
                  <Text className="text-slate-400 text-sm mt-1">Detecting prep items</Text>
                </View>
              </View>
            </View>
          )}

          {/* Results */}
          {scanState === 'results' && (
            <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
              {/* Error */}
              {error && (
                <View className="bg-red-500/20 rounded-2xl p-4 mt-4 border border-red-500/30">
                  <Text className="text-red-400 font-semibold">Scan Failed</Text>
                  <Text className="text-red-300 text-sm mt-1">{error}</Text>
                </View>
              )}

              {/* Image Preview */}
              {imageUri && (
                <View className="mt-4">
                  <Image source={{ uri: imageUri }} className="w-full h-48 rounded-2xl bg-slate-800" resizeMode="cover" />
                </View>
              )}

              {/* Results */}
              {scanResult && scanResult.length > 0 && !error && (
                <>
                  <View className="rounded-2xl p-4 mt-4 border" style={{ backgroundColor: `${accentColor}20`, borderColor: `${accentColor}30` }}>
                    <Text className="font-bold text-lg" style={{ color: accentColor }}>
                      {scanResult.length} Item{scanResult.length !== 1 ? 's' : ''} Detected
                    </Text>
                    <Text className="text-slate-400 text-sm mt-1">
                      Select items to add as {defaultItemType === 'ingredient' ? 'ingredients' : 'prepped items'}
                    </Text>
                  </View>

                  {scanResult.map((item, index) => (
                    <Pressable
                      key={index}
                      className="bg-slate-800/60 rounded-2xl p-4 mt-3 border"
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
                          <View className="flex-row flex-wrap gap-2 mt-2">
                            <View className="bg-slate-700/50 px-2 py-1 rounded">
                              <Text className="text-slate-300 text-xs">{item.category}</Text>
                            </View>
                            <View className="bg-amber-500/20 px-2 py-1 rounded">
                              <Text className="text-amber-400 text-xs">
                                Par: {item.suggestedParLevel} {getUnitLabel(item.suggestedUnit as PrepUnit)}
                              </Text>
                            </View>
                          </View>
                          {item.notes && (
                            <Text className="text-slate-500 text-xs mt-2 italic">{item.notes}</Text>
                          )}
                        </View>
                      </View>
                    </Pressable>
                  ))}

                  {/* Add Button */}
                  <Pressable
                    className="rounded-2xl py-4 items-center mt-4 mb-8"
                    style={{
                      backgroundColor: selectedItems.size > 0 ? accentColor : '#334155',
                      opacity: selectedItems.size === 0 ? 0.7 : 1,
                    }}
                    onPress={handleAddSelected}
                    disabled={selectedItems.size === 0}
                  >
                    <View className="flex-row items-center">
                      <Plus size={20} color={selectedItems.size > 0 ? '#FFFFFF' : '#64748B'} />
                      <Text className={`font-bold text-base ml-2 ${selectedItems.size > 0 ? 'text-white' : 'text-slate-500'}`}>
                        Add {selectedItems.size} Item{selectedItems.size !== 1 ? 's' : ''}
                      </Text>
                    </View>
                  </Pressable>
                </>
              )}

              {/* No Results */}
              {scanResult && scanResult.length === 0 && !error && (
                <View className="bg-slate-800/60 rounded-2xl p-8 items-center mt-4 border border-slate-700/50">
                  <Package size={40} color="#64748B" />
                  <Text className="text-slate-400 mt-3 text-center">No prep items detected in this image</Text>
                  <Pressable
                    className="rounded-xl px-6 py-3 mt-4 active:opacity-80"
                    style={{ backgroundColor: accentColor }}
                    onPress={reset}
                  >
                    <Text className="text-white font-bold">Try Another Photo</Text>
                  </Pressable>
                </View>
              )}
            </ScrollView>
          )}

          {/* Bottom hint */}
          {scanState === 'camera' && permission?.granted && (
            <View className="px-5 pb-6">
              <Text className="text-slate-500 text-center text-sm">
                Point camera at ingredients or prepped items to scan
              </Text>
            </View>
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

export default function PrepSheetScreen() {
  const industry = useIndustryStore((s) => s.industry);
  const config = industry ? INDUSTRY_CONFIGS[industry] : null;
  const accentColor = config?.color ?? '#F59E0B';
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['prep-items'],
    queryFn: () => api.get<GetPrepItemsResponse>('/api/prep-items'),
  });

  const items = data?.items ?? [];

  // Filter items
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      searchQuery === '' || item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === null || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Group by category
  const groupedItems = filteredItems.reduce(
    (acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    },
    {} as Record<string, PrepItem[]>
  );

  const categories = Object.keys(groupedItems).sort();

  // Stats
  const totalItems = items.length;
  const itemsNeedingPrep = items.filter((i) => i.currentLevel < i.parLevel).length;

  // Mutations
  const { mutate: createItem } = useMutation({
    mutationFn: (data: CreatePrepItemRequest) => api.post('/api/prep-items', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prep-items'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const { mutate: updateLevel } = useMutation({
    mutationFn: ({ id, currentLevel }: { id: string; currentLevel: number }) =>
      api.patch(`/api/prep-items/${id}`, { currentLevel }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prep-items'] });
    },
  });

  const { mutate: logPrep } = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) =>
      api.post(`/api/prep-items/${id}/log`, { quantityPrepped: quantity }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prep-items'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const handleUpdateLevel = useCallback(
    (id: string, newLevel: number) => {
      updateLevel({ id, currentLevel: newLevel });
    },
    [updateLevel]
  );

  const handleLogPrep = useCallback(
    (id: string, quantity: number) => {
      logPrep({ id, quantity });
    },
    [logPrep]
  );

  const handleAddItem = useCallback(
    (itemData: CreatePrepItemRequest) => {
      createItem(itemData);
    },
    [createItem]
  );

  const handleAddScannedItems = useCallback(
    (items: CreatePrepItemRequest[]) => {
      items.forEach((item) => createItem(item));
    },
    [createItem]
  );

  // Only show for restaurant industry
  if (industry !== 'restaurant') {
    return (
      <View className="flex-1 bg-neutral-900 items-center justify-center px-8">
        <ClipboardList size={64} color="#64748B" />
        <Text className="text-white text-xl font-bold mt-4 text-center">
          Prep Sheets for Restaurants
        </Text>
        <Text className="text-slate-400 text-center mt-2">
          This feature is only available for restaurant inventory mode.
        </Text>
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
        {/* Header */}
        <View className="px-5 pt-4 pb-4 flex-row items-center justify-between">
          <View>
            <View className="flex-row items-center gap-2 mb-1">
              <ClipboardList size={14} color={accentColor} />
              <Text className="text-xs font-medium" style={{ color: accentColor }}>
                Restaurant
              </Text>
            </View>
            <Text className="text-white text-2xl font-bold">Prep Sheet</Text>
            <Text className="text-slate-400 text-sm mt-1">
              {itemsNeedingPrep > 0 ? (
                <Text>
                  <Text style={{ color: '#F59E0B' }}>{itemsNeedingPrep}</Text> items need prep
                </Text>
              ) : (
                `${totalItems} items at par`
              )}
            </Text>
          </View>
          <View className="flex-row gap-2">
            <Pressable
              className="w-12 h-12 rounded-xl items-center justify-center active:opacity-80 bg-slate-800 border border-slate-700"
              onPress={() => setShowScanModal(true)}
            >
              <Scan size={22} color={accentColor} />
            </Pressable>
            <Pressable
              className="w-12 h-12 rounded-xl items-center justify-center active:opacity-80"
              style={{ backgroundColor: accentColor }}
              onPress={() => setShowAddModal(true)}
            >
              <Plus size={24} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        {/* Search & Filter Bar */}
        <View className="px-5 mb-4">
          <View className="flex-row items-center gap-2">
            <View className="flex-1 bg-slate-800/60 rounded-xl flex-row items-center px-4 border border-slate-700/50">
              <Search size={20} color="#64748B" />
              <TextInput
                className="flex-1 py-3 px-3 text-white"
                placeholder="Search prep items..."
                placeholderTextColor="#64748B"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
            <Pressable
              className="bg-slate-800/60 w-12 h-12 rounded-xl items-center justify-center border border-slate-700/50 active:opacity-80"
              onPress={() => setShowFilterModal(true)}
            >
              <Filter
                size={20}
                color={selectedCategory ? accentColor : '#64748B'}
              />
            </Pressable>
          </View>
          {selectedCategory && (
            <Pressable
              className="mt-2 rounded-lg px-3 py-2 flex-row items-center justify-between"
              style={{ backgroundColor: `${accentColor}20` }}
              onPress={() => setSelectedCategory(null)}
            >
              <Text style={{ color: accentColor }} className="text-sm">
                Filtered: {selectedCategory}
              </Text>
              <X size={16} color={accentColor} />
            </Pressable>
          )}
        </View>

        {/* Items List */}
        <ScrollView
          className="flex-1 px-5"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={accentColor} />
          }
        >
          {isLoading ? (
            <View className="bg-slate-800/60 rounded-2xl p-8 items-center border border-slate-700/50">
              <Text className="text-slate-400">Loading prep items...</Text>
            </View>
          ) : filteredItems.length === 0 ? (
            <View className="bg-slate-800/60 rounded-2xl p-8 items-center border border-slate-700/50">
              <Package size={40} color="#64748B" />
              <Text className="text-slate-400 mt-3 text-center">
                {searchQuery || selectedCategory
                  ? 'No matching prep items'
                  : 'No prep items yet'}
              </Text>
              {!searchQuery && !selectedCategory && (
                <View className="flex-row gap-2 mt-4">
                  <Pressable
                    className="rounded-xl px-4 py-3 active:opacity-80 flex-row items-center gap-2"
                    style={{ backgroundColor: accentColor }}
                    onPress={() => setShowAddModal(true)}
                  >
                    <Plus size={16} color="#FFFFFF" />
                    <Text className="text-white font-bold">Add</Text>
                  </Pressable>
                  <Pressable
                    className="rounded-xl px-4 py-3 active:opacity-80 flex-row items-center gap-2 bg-slate-700"
                    onPress={() => setShowScanModal(true)}
                  >
                    <Scan size={16} color="#FFFFFF" />
                    <Text className="text-white font-bold">Scan</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ) : (
            categories.map((category, categoryIndex) => (
              <Animated.View
                key={category}
                entering={FadeInUp.delay(categoryIndex * 100).springify()}
              >
                {/* Category Header */}
                <View className="flex-row items-center mb-3 mt-4">
                  <View
                    className="w-1 h-5 rounded-full mr-2"
                    style={{ backgroundColor: accentColor }}
                  />
                  <Text className="text-white font-bold text-lg">{category}</Text>
                  <View className="bg-slate-700/50 rounded-full px-2 py-0.5 ml-2">
                    <Text className="text-slate-400 text-xs">
                      {groupedItems[category]?.length ?? 0}
                    </Text>
                  </View>
                </View>

                {/* Items in Category */}
                {groupedItems[category]?.map((item, itemIndex) => (
                  <PrepItemCard
                    key={item.id}
                    item={item}
                    accentColor={accentColor}
                    onUpdateLevel={handleUpdateLevel}
                    onLogPrep={handleLogPrep}
                    index={itemIndex}
                  />
                ))}
              </Animated.View>
            ))
          )}
          <View className="h-8" />
        </ScrollView>

        {/* Add Item Modal */}
        <AddItemModal
          visible={showAddModal}
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddItem}
          accentColor={accentColor}
          defaultItemType="prepped"
        />

        {/* SmartScan Modal */}
        <SmartScanModal
          visible={showScanModal}
          onClose={() => setShowScanModal(false)}
          onAddItems={handleAddScannedItems}
          accentColor={accentColor}
          defaultItemType="prepped"
        />

        {/* Filter Modal */}
        <Modal visible={showFilterModal} transparent animationType="fade">
          <Pressable
            className="flex-1 bg-black/60 justify-end"
            onPress={() => setShowFilterModal(false)}
          >
            <View className="bg-slate-800 rounded-t-3xl max-h-[60%]">
              <View className="p-4 border-b border-slate-700 flex-row items-center justify-between">
                <Text className="text-white font-bold text-lg">Filter by Category</Text>
                {selectedCategory && (
                  <Pressable onPress={() => setSelectedCategory(null)}>
                    <Text style={{ color: accentColor }} className="font-medium">
                      Clear
                    </Text>
                  </Pressable>
                )}
              </View>
              <ScrollView className="p-4">
                {PREP_CATEGORIES.map((cat) => (
                  <Pressable
                    key={cat}
                    className="py-3 px-4 rounded-xl mb-1 flex-row justify-between items-center"
                    style={
                      selectedCategory === cat ? { backgroundColor: `${accentColor}20` } : {}
                    }
                    onPress={() => {
                      setSelectedCategory(cat);
                      setShowFilterModal(false);
                    }}
                  >
                    <Text
                      className={`text-base ${selectedCategory === cat ? 'font-bold' : ''}`}
                      style={{ color: selectedCategory === cat ? accentColor : '#F8FAFC' }}
                    >
                      {cat}
                    </Text>
                    {selectedCategory === cat && <Check size={18} color={accentColor} />}
                  </Pressable>
                ))}
                <View className="h-8" />
              </ScrollView>
            </View>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </View>
  );
}
