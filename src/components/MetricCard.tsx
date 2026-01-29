import React from 'react';
import { View, Text, Pressable } from 'react-native';
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
} from 'lucide-react-native';
import type { MetricConfig, MetricType } from '@/lib/dashboard-store';
import type { InventoryItem } from '@/shared/contracts';

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

interface MetricCardProps {
  config: MetricConfig;
  items: InventoryItem[];
  stats: {
    total: number;
    pending: number;
    completed: number;
    sold: number;
  };
  onPress?: () => void;
  fullWidth?: boolean;
}

// Calculate metric value based on type
function calculateMetricValue(
  metricId: MetricType,
  items: InventoryItem[],
  stats: { total: number; pending: number; completed: number; sold: number }
): number {
  const activeItems = items.filter((item) => item.status === 'pending');

  switch (metricId) {
    case 'total_items':
      return stats.total;

    case 'in_stock':
      return stats.pending;

    case 'low_stock':
      // Items with quantity <= 2 considered low stock
      return activeItems.filter((item) => item.quantity <= 2).length;

    case 'total_value':
      // Sum of soldPrice (listing price) for active items
      return activeItems.reduce((sum, item) => {
        const price = item.soldPrice ?? 0;
        return sum + price * item.quantity;
      }, 0);

    case 'total_cogs':
      // Sum of cost for all items
      return items.reduce((sum, item) => {
        const cost = item.cost ?? 0;
        return sum + cost * item.quantity;
      }, 0);

    case 'potential_profit':
      // Total value - COGS for active items
      return activeItems.reduce((sum, item) => {
        const price = item.soldPrice ?? 0;
        const cost = item.cost ?? 0;
        return sum + (price - cost) * item.quantity;
      }, 0);

    case 'items_expiring':
      // Items with shipByDate within 7 days
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      return activeItems.filter((item) => {
        if (!item.shipByDate) return false;
        const shipDate = new Date(item.shipByDate);
        return shipDate <= sevenDaysFromNow;
      }).length;

    case 'below_par':
      // Items with quantity 0
      return activeItems.filter((item) => item.quantity === 0).length;

    case 'needs_attention':
      // Low stock or expiring soon
      const lowStock = activeItems.filter((item) => item.quantity <= 2).length;
      return lowStock;

    case 'items_sold':
      return stats.sold;

    case 'avg_item_value':
      if (activeItems.length === 0) return 0;
      const totalValue = activeItems.reduce((sum, item) => {
        return sum + (item.soldPrice ?? 0);
      }, 0);
      return totalValue / activeItems.length;

    case 'categories_count':
      const categories = new Set(
        items.map((item) => item.platform || 'Uncategorized')
      );
      return categories.size;

    default:
      return 0;
  }
}

// Format value based on format type
function formatValue(value: number, format: 'number' | 'currency' | 'percentage'): string {
  switch (format) {
    case 'currency':
      return `$${value.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })}`;
    case 'percentage':
      return `${value.toFixed(1)}%`;
    case 'number':
    default:
      return value.toLocaleString();
  }
}

interface MetricCardGridProps extends MetricCardProps {}

export function MetricCard({ config, items, stats, onPress, fullWidth }: MetricCardProps) {
  const IconComponent = ICON_MAP[config.icon] ?? Package;
  const value = calculateMetricValue(config.id, items, stats);
  const formattedValue = formatValue(value, config.format);

  return (
    <Pressable
      className={`bg-slate-800/60 rounded-2xl p-4 border border-slate-700/50 active:opacity-80 ${fullWidth ? 'flex-1' : ''}`}
      onPress={onPress}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="text-slate-400 text-xs font-medium mb-1">{config.label}</Text>
          <Text
            className="text-2xl font-bold"
            style={{ color: config.format === 'currency' ? config.color : '#FFFFFF' }}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {formattedValue}
          </Text>
        </View>
        <View
          className="w-12 h-12 rounded-xl items-center justify-center ml-3"
          style={{ backgroundColor: config.bgColor }}
        >
          <IconComponent size={24} color={config.color} />
        </View>
      </View>
    </Pressable>
  );
}

// Export calculation function for use elsewhere
export { calculateMetricValue, formatValue };
