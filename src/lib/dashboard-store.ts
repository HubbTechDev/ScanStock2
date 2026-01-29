import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// All available metric types
export type MetricType =
  | 'total_items'
  | 'in_stock'
  | 'low_stock'
  | 'total_value'
  | 'total_cogs'
  | 'potential_profit'
  | 'items_expiring'
  | 'below_par'
  | 'needs_attention'
  | 'items_sold'
  | 'avg_item_value'
  | 'categories_count';

export interface MetricConfig {
  id: MetricType;
  label: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
  format: 'number' | 'currency' | 'percentage';
}

// All available metrics
export const AVAILABLE_METRICS: MetricConfig[] = [
  {
    id: 'total_items',
    label: 'Total Items',
    description: 'Total number of items in inventory',
    icon: 'Package',
    color: '#06B6D4',
    bgColor: '#06B6D420',
    format: 'number',
  },
  {
    id: 'in_stock',
    label: 'In Stock',
    description: 'Items currently in stock',
    icon: 'CheckCircle',
    color: '#10B981',
    bgColor: '#10B98120',
    format: 'number',
  },
  {
    id: 'low_stock',
    label: 'Low Stock',
    description: 'Items that are running low',
    icon: 'AlertTriangle',
    color: '#F59E0B',
    bgColor: '#F59E0B20',
    format: 'number',
  },
  {
    id: 'total_value',
    label: 'Inventory Value',
    description: 'Total monetary value of inventory on hand',
    icon: 'DollarSign',
    color: '#10B981',
    bgColor: '#10B98120',
    format: 'currency',
  },
  {
    id: 'total_cogs',
    label: 'Total COGS',
    description: 'Cost of goods sold (total cost of all items)',
    icon: 'Receipt',
    color: '#EF4444',
    bgColor: '#EF444420',
    format: 'currency',
  },
  {
    id: 'potential_profit',
    label: 'Potential Profit',
    description: 'Expected profit if all items sell at listed price',
    icon: 'TrendingUp',
    color: '#8B5CF6',
    bgColor: '#8B5CF620',
    format: 'currency',
  },
  {
    id: 'items_expiring',
    label: 'Expiring Soon',
    description: 'Items expiring within the next 7 days',
    icon: 'Clock',
    color: '#EF4444',
    bgColor: '#EF444420',
    format: 'number',
  },
  {
    id: 'below_par',
    label: 'Below Par',
    description: 'Items below minimum stock level',
    icon: 'AlertCircle',
    color: '#F59E0B',
    bgColor: '#F59E0B20',
    format: 'number',
  },
  {
    id: 'needs_attention',
    label: 'Needs Attention',
    description: 'Items requiring immediate attention',
    icon: 'AlertTriangle',
    color: '#F59E0B',
    bgColor: '#F59E0B20',
    format: 'number',
  },
  {
    id: 'items_sold',
    label: 'Items Sold',
    description: 'Total items marked as sold',
    icon: 'ShoppingBag',
    color: '#8B5CF6',
    bgColor: '#8B5CF620',
    format: 'number',
  },
  {
    id: 'avg_item_value',
    label: 'Avg Item Value',
    description: 'Average value per inventory item',
    icon: 'Calculator',
    color: '#06B6D4',
    bgColor: '#06B6D420',
    format: 'currency',
  },
  {
    id: 'categories_count',
    label: 'Categories',
    description: 'Number of unique categories',
    icon: 'Layers',
    color: '#EC4899',
    bgColor: '#EC489920',
    format: 'number',
  },
];

// Default metrics to show
const DEFAULT_METRICS: MetricType[] = [
  'total_items',
  'in_stock',
  'total_value',
  'total_cogs',
];

interface DashboardStore {
  selectedMetrics: MetricType[];
  setSelectedMetrics: (metrics: MetricType[]) => void;
  addMetric: (metric: MetricType) => void;
  removeMetric: (metric: MetricType) => void;
  reorderMetrics: (metrics: MetricType[]) => void;
  resetToDefaults: () => void;
  getMetricConfig: (id: MetricType) => MetricConfig | undefined;
}

export const useDashboardStore = create<DashboardStore>()(
  persist(
    (set, get) => ({
      selectedMetrics: DEFAULT_METRICS,

      setSelectedMetrics: (metrics) => set({ selectedMetrics: metrics }),

      addMetric: (metric) => {
        const current = get().selectedMetrics;
        if (!current.includes(metric)) {
          set({ selectedMetrics: [...current, metric] });
        }
      },

      removeMetric: (metric) => {
        const current = get().selectedMetrics;
        set({ selectedMetrics: current.filter((m) => m !== metric) });
      },

      reorderMetrics: (metrics) => set({ selectedMetrics: metrics }),

      resetToDefaults: () => set({ selectedMetrics: DEFAULT_METRICS }),

      getMetricConfig: (id) => AVAILABLE_METRICS.find((m) => m.id === id),
    }),
    {
      name: 'dashboard-metrics-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
