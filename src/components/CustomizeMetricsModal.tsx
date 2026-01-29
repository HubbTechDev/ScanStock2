import React, { useCallback } from 'react';
import { View, Text, ScrollView, Pressable, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Check, GripVertical, RotateCcw, ChevronUp, ChevronDown, Trash2 } from 'lucide-react-native';
import {
  Package,
  CheckCircle,
  AlertTriangle,
  DollarSign,
  Receipt,
  TrendingUp,
  Clock,
  AlertCircle,
  ShoppingBag,
  Calculator,
  Layers,
  LucideIcon,
  Plus,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import {
  useDashboardStore,
  AVAILABLE_METRICS,
  type MetricType,
  type MetricConfig,
} from '@/lib/dashboard-store';

// Icon mapping
const ICON_MAP: Record<string, LucideIcon> = {
  Package,
  CheckCircle,
  AlertTriangle,
  DollarSign,
  Receipt,
  TrendingUp,
  Clock,
  AlertCircle,
  ShoppingBag,
  Calculator,
  Layers,
};

interface CustomizeMetricsModalProps {
  visible: boolean;
  onClose: () => void;
}

export function CustomizeMetricsModal({ visible, onClose }: CustomizeMetricsModalProps) {
  const selectedMetrics = useDashboardStore((s) => s.selectedMetrics);
  const addMetric = useDashboardStore((s) => s.addMetric);
  const removeMetric = useDashboardStore((s) => s.removeMetric);
  const reorderMetrics = useDashboardStore((s) => s.reorderMetrics);
  const resetToDefaults = useDashboardStore((s) => s.resetToDefaults);

  const isSelected = (id: MetricType) => selectedMetrics.includes(id);

  const moveMetricUp = useCallback((index: number) => {
    if (index === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newOrder = [...selectedMetrics];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    reorderMetrics(newOrder);
  }, [selectedMetrics, reorderMetrics]);

  const moveMetricDown = useCallback((index: number) => {
    if (index === selectedMetrics.length - 1) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newOrder = [...selectedMetrics];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    reorderMetrics(newOrder);
  }, [selectedMetrics, reorderMetrics]);

  const handleRemoveMetric = useCallback((id: MetricType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    removeMetric(id);
  }, [removeMetric]);

  const handleAddMetric = useCallback((id: MetricType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addMetric(id);
  }, [addMetric]);

  const handleReset = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    resetToDefaults();
  }, [resetToDefaults]);

  const renderActiveMetricItem = (config: MetricConfig, index: number) => {
    const IconComponent = ICON_MAP[config.icon] ?? Package;
    const isFirst = index === 0;
    const isLast = index === selectedMetrics.length - 1;

    return (
      <View
        key={config.id}
        className="flex-row items-center p-3 rounded-xl mb-2"
        style={{
          backgroundColor: `${config.color}15`,
          borderWidth: 1,
          borderColor: config.color,
        }}
      >
        {/* Reorder Controls */}
        <View className="mr-2">
          <Pressable
            className="p-1.5 rounded-lg active:opacity-60"
            style={{ backgroundColor: isFirst ? 'transparent' : '#334155' }}
            onPress={() => moveMetricUp(index)}
            disabled={isFirst}
          >
            <ChevronUp size={18} color={isFirst ? '#475569' : '#94A3B8'} />
          </Pressable>
          <Pressable
            className="p-1.5 rounded-lg mt-1 active:opacity-60"
            style={{ backgroundColor: isLast ? 'transparent' : '#334155' }}
            onPress={() => moveMetricDown(index)}
            disabled={isLast}
          >
            <ChevronDown size={18} color={isLast ? '#475569' : '#94A3B8'} />
          </Pressable>
        </View>

        {/* Icon */}
        <View
          className="w-10 h-10 rounded-xl items-center justify-center mr-3"
          style={{ backgroundColor: config.bgColor }}
        >
          <IconComponent size={20} color={config.color} />
        </View>

        {/* Label */}
        <View className="flex-1">
          <Text className="text-white font-semibold">{config.label}</Text>
          <Text className="text-slate-400 text-xs mt-0.5" numberOfLines={1}>
            Position {index + 1}
          </Text>
        </View>

        {/* Remove Button */}
        <Pressable
          className="w-9 h-9 rounded-full items-center justify-center active:opacity-60"
          style={{ backgroundColor: '#EF444430' }}
          onPress={() => handleRemoveMetric(config.id)}
        >
          <Trash2 size={16} color="#EF4444" />
        </Pressable>
      </View>
    );
  };

  const renderAvailableMetricItem = (config: MetricConfig) => {
    const IconComponent = ICON_MAP[config.icon] ?? Package;

    return (
      <Pressable
        key={config.id}
        className="flex-row items-center p-3 rounded-xl mb-2 active:opacity-80"
        style={{
          backgroundColor: '#1E293B',
          borderWidth: 1,
          borderColor: '#334155',
        }}
        onPress={() => handleAddMetric(config.id)}
      >
        <View
          className="w-10 h-10 rounded-xl items-center justify-center mr-3"
          style={{ backgroundColor: config.bgColor }}
        >
          <IconComponent size={20} color={config.color} />
        </View>
        <View className="flex-1">
          <Text className="text-white font-semibold">{config.label}</Text>
          <Text className="text-slate-400 text-xs mt-0.5" numberOfLines={1}>
            {config.description}
          </Text>
        </View>
        <View
          className="w-9 h-9 rounded-full items-center justify-center"
          style={{ backgroundColor: `${config.color}30` }}
        >
          <Plus size={18} color={config.color} />
        </View>
      </Pressable>
    );
  };

  const availableMetrics = AVAILABLE_METRICS.filter((m) => !selectedMetrics.includes(m.id));

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-slate-900">
        <SafeAreaView className="flex-1" edges={['top']}>
          {/* Header */}
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
            <View className="flex-row items-center gap-3">
              <Pressable
                className="w-10 h-10 rounded-full bg-slate-800 items-center justify-center active:opacity-80"
                onPress={onClose}
              >
                <X size={20} color="#94A3B8" />
              </Pressable>
              <Text className="text-white text-xl font-bold">Customize Metrics</Text>
            </View>
            <Pressable
              className="flex-row items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 active:opacity-80"
              onPress={handleReset}
            >
              <RotateCcw size={16} color="#94A3B8" />
              <Text className="text-slate-400 text-sm">Reset</Text>
            </Pressable>
          </View>

          {/* Info Banner */}
          <View className="mx-5 mt-4 p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30">
            <Text className="text-cyan-400 text-sm text-center">
              Use the arrows to reorder metrics on your dashboard
            </Text>
          </View>

          {/* Metrics List */}
          <ScrollView
            className="flex-1 px-5 mt-4"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            {/* Active Metrics Section */}
            {selectedMetrics.length > 0 && (
              <View className="mb-6">
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-white font-semibold">Active Metrics</Text>
                  <Text className="text-slate-500 text-xs">{selectedMetrics.length} selected</Text>
                </View>
                {selectedMetrics.map((id, index) => {
                  const config = AVAILABLE_METRICS.find((m) => m.id === id);
                  if (!config) return null;
                  return renderActiveMetricItem(config, index);
                })}
              </View>
            )}

            {/* Available Metrics Section */}
            {availableMetrics.length > 0 && (
              <View>
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-white font-semibold">Available Metrics</Text>
                  <Text className="text-slate-500 text-xs">Tap to add</Text>
                </View>
                {availableMetrics.map(renderAvailableMetricItem)}
              </View>
            )}

            {/* Empty State */}
            {selectedMetrics.length === 0 && (
              <View className="items-center py-8">
                <GripVertical size={48} color="#475569" />
                <Text className="text-slate-400 mt-4 text-center">No metrics selected</Text>
                <Text className="text-slate-500 text-sm mt-1 text-center">
                  Add metrics from the list below
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Done Button */}
          <View className="px-5 pb-8 pt-4 border-t border-slate-800">
            <Pressable
              className="bg-cyan-500 rounded-xl py-4 items-center active:opacity-80"
              onPress={onClose}
            >
              <Text className="text-white font-bold text-lg">Done</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
