import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Modal, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Plus, Trash2, GripVertical, MapPin, Pencil, X, Check } from 'lucide-react-native';
import { useStorageLocations, type LocationField } from '@/lib/storage-locations';

export default function StorageSettingsScreen() {
  const router = useRouter();
  const { locationFields, isLoaded, loadLocations, updateLocationField, addLocationField, removeLocationField } = useStorageLocations();

  const [editingField, setEditingField] = useState<LocationField | null>(null);
  const [editName, setEditName] = useState('');
  const [editPlaceholder, setEditPlaceholder] = useState('');

  useEffect(() => {
    loadLocations();
  }, []);

  const handleEditField = (field: LocationField) => {
    setEditingField(field);
    setEditName(field.name);
    setEditPlaceholder(field.placeholder);
  };

  const handleSaveEdit = async () => {
    if (editingField && editName.trim()) {
      await updateLocationField(editingField.id, {
        name: editName.trim(),
        placeholder: editPlaceholder.trim() || 'Enter value',
      });
      setEditingField(null);
    }
  };

  const handleToggleField = async (field: LocationField) => {
    await updateLocationField(field.id, { enabled: !field.enabled });
  };

  const handleRemoveField = (field: LocationField) => {
    Alert.alert(
      'Remove Location Field',
      `Are you sure you want to remove "${field.name}"? This will not affect existing items.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeLocationField(field.id),
        },
      ]
    );
  };

  const handleAddField = async () => {
    await addLocationField();
  };

  if (!isLoaded) {
    return (
      <View className="flex-1 bg-neutral-900 items-center justify-center">
        <Text className="text-white">Loading...</Text>
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
          <Pressable
            className="w-10 h-10 rounded-full bg-slate-800 items-center justify-center active:opacity-80"
            onPress={() => router.back()}
          >
            <ArrowLeft size={20} color="#F8FAFC" />
          </Pressable>
          <Text className="text-white text-lg font-bold">Storage Locations</Text>
          <View className="w-10" />
        </View>

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* Description */}
          <View className="px-5 mb-6">
            <View className="bg-cyan-500/10 rounded-2xl p-4 border border-cyan-500/30">
              <View className="flex-row items-center mb-2">
                <MapPin size={18} color="#06B6D4" />
                <Text className="text-cyan-400 font-semibold ml-2">Customize Your Storage</Text>
              </View>
              <Text className="text-slate-400 text-sm">
                Define the location fields that match your storage system. Add bins, racks, shelves, or any custom location types you need.
              </Text>
            </View>
          </View>

          {/* Location Fields */}
          <View className="px-5">
            <Text className="text-white font-bold text-lg mb-3">Location Fields</Text>

            {locationFields.map((field, index) => (
              <View
                key={field.id}
                className={`bg-slate-800/60 rounded-2xl p-4 mb-3 border ${
                  field.enabled ? 'border-slate-700/50' : 'border-slate-800 opacity-60'
                }`}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <View className="w-8 h-8 rounded-lg bg-slate-700/50 items-center justify-center mr-3">
                      <Text className="text-slate-400 font-bold">{index + 1}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-white font-semibold">{field.name}</Text>
                      <Text className="text-slate-500 text-xs mt-0.5">{field.placeholder}</Text>
                    </View>
                  </View>

                  <View className="flex-row items-center gap-2">
                    <Pressable
                      className="w-9 h-9 rounded-lg bg-slate-700/50 items-center justify-center active:opacity-80"
                      onPress={() => handleEditField(field)}
                    >
                      <Pencil size={16} color="#06B6D4" />
                    </Pressable>
                    <Pressable
                      className={`w-9 h-9 rounded-lg items-center justify-center active:opacity-80 ${
                        field.enabled ? 'bg-cyan-500' : 'bg-slate-700/50'
                      }`}
                      onPress={() => handleToggleField(field)}
                    >
                      <Check size={16} color={field.enabled ? '#FFFFFF' : '#64748B'} />
                    </Pressable>
                    <Pressable
                      className="w-9 h-9 rounded-lg bg-red-500/20 items-center justify-center active:opacity-80"
                      onPress={() => handleRemoveField(field)}
                    >
                      <Trash2 size={16} color="#EF4444" />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}

            {/* Add New Field Button */}
            <Pressable
              className="bg-slate-800/40 rounded-2xl p-4 border border-dashed border-slate-600 flex-row items-center justify-center active:opacity-80"
              onPress={handleAddField}
            >
              <Plus size={20} color="#06B6D4" />
              <Text className="text-cyan-400 font-semibold ml-2">Add Location Field</Text>
            </Pressable>
          </View>

          {/* Tips */}
          <View className="px-5 mt-8 pb-8">
            <Text className="text-white font-bold text-lg mb-3">Tips</Text>
            <View className="bg-slate-800/40 rounded-xl p-4">
              <View className="flex-row items-start mb-3">
                <View className="bg-cyan-500/20 w-6 h-6 rounded-full items-center justify-center mr-3 mt-0.5">
                  <Text className="text-cyan-400 text-xs font-bold">1</Text>
                </View>
                <Text className="text-slate-300 flex-1">
                  Use short, descriptive names like "Bin", "Shelf", or "Room"
                </Text>
              </View>
              <View className="flex-row items-start mb-3">
                <View className="bg-cyan-500/20 w-6 h-6 rounded-full items-center justify-center mr-3 mt-0.5">
                  <Text className="text-cyan-400 text-xs font-bold">2</Text>
                </View>
                <Text className="text-slate-300 flex-1">
                  Add example values in the placeholder to guide entry
                </Text>
              </View>
              <View className="flex-row items-start">
                <View className="bg-cyan-500/20 w-6 h-6 rounded-full items-center justify-center mr-3 mt-0.5">
                  <Text className="text-cyan-400 text-xs font-bold">3</Text>
                </View>
                <Text className="text-slate-300 flex-1">
                  Disable fields you don't use instead of removing them
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Edit Field Modal */}
      <Modal
        visible={editingField !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingField(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <View className="flex-1 justify-end bg-black/50">
            <View className="bg-slate-900 rounded-t-3xl p-5 pb-8">
              <View className="flex-row items-center justify-between mb-6">
                <Pressable
                  className="w-10 h-10 rounded-full bg-slate-800 items-center justify-center"
                  onPress={() => setEditingField(null)}
                >
                  <X size={20} color="#F8FAFC" />
                </Pressable>
                <Text className="text-white text-lg font-bold">Edit Location Field</Text>
                <Pressable
                  className="w-10 h-10 rounded-full bg-cyan-500 items-center justify-center"
                  onPress={handleSaveEdit}
                >
                  <Check size={20} color="#FFFFFF" />
                </Pressable>
              </View>

              <View className="mb-4">
                <Text className="text-slate-400 text-sm mb-2">Field Name</Text>
                <TextInput
                  className="bg-slate-800 rounded-xl px-4 py-3 text-white border border-slate-700"
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="e.g., Bin Number"
                  placeholderTextColor="#64748B"
                />
              </View>

              <View className="mb-6">
                <Text className="text-slate-400 text-sm mb-2">Placeholder Text</Text>
                <TextInput
                  className="bg-slate-800 rounded-xl px-4 py-3 text-white border border-slate-700"
                  value={editPlaceholder}
                  onChangeText={setEditPlaceholder}
                  placeholder="e.g., A1, B2"
                  placeholderTextColor="#64748B"
                />
                <Text className="text-slate-500 text-xs mt-2">
                  This appears as a hint when the field is empty
                </Text>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
