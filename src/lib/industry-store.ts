import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type IndustryType = 'retail' | 'restaurant' | 'hospitality' | null;

export interface IndustryConfig {
  id: IndustryType;
  name: string;
  description: string;
  icon: string;
  color: string;
  primaryFields: { id: string; label: string; placeholder: string }[];
  categories: string[];
  statusOptions: { id: string; label: string; color: string }[];
}

export const INDUSTRY_CONFIGS: Record<Exclude<IndustryType, null>, IndustryConfig> = {
  retail: {
    id: 'retail',
    name: 'Retail',
    description: 'Track products, SKUs, inventory levels, and sales',
    icon: 'ShoppingBag',
    color: '#8B5CF6',
    primaryFields: [
      { id: 'sku', label: 'SKU', placeholder: 'e.g., SKU-12345' },
      { id: 'location', label: 'Location', placeholder: 'e.g., Aisle 3, Shelf B' },
      { id: 'price', label: 'Price', placeholder: '0.00' },
      { id: 'cost', label: 'Cost', placeholder: '0.00' },
    ],
    categories: [
      'Electronics',
      'Clothing',
      'Home & Garden',
      'Sports & Outdoors',
      'Beauty & Health',
      'Toys & Games',
      'Food & Beverages',
      'Office Supplies',
      'Automotive',
      'Other',
    ],
    statusOptions: [
      { id: 'in_stock', label: 'In Stock', color: '#10B981' },
      { id: 'low_stock', label: 'Low Stock', color: '#F59E0B' },
      { id: 'out_of_stock', label: 'Out of Stock', color: '#EF4444' },
      { id: 'discontinued', label: 'Discontinued', color: '#64748B' },
    ],
  },
  restaurant: {
    id: 'restaurant',
    name: 'Restaurant',
    description: 'Manage ingredients, track expiration, and monitor stock levels',
    icon: 'UtensilsCrossed',
    color: '#F59E0B',
    primaryFields: [
      { id: 'unit', label: 'Unit', placeholder: 'e.g., lb, oz, each' },
      { id: 'parLevel', label: 'Par Level', placeholder: 'Minimum quantity' },
      { id: 'storage', label: 'Storage', placeholder: 'e.g., Walk-in, Dry Storage' },
      { id: 'supplier', label: 'Supplier', placeholder: 'Vendor name' },
    ],
    categories: [
      'Produce',
      'Meat & Poultry',
      'Seafood',
      'Dairy',
      'Dry Goods',
      'Frozen',
      'Beverages',
      'Condiments & Sauces',
      'Spices & Seasonings',
      'Paper & Supplies',
      'Cleaning Supplies',
      'Other',
    ],
    statusOptions: [
      { id: 'fresh', label: 'Fresh', color: '#10B981' },
      { id: 'expiring_soon', label: 'Expiring Soon', color: '#F59E0B' },
      { id: 'expired', label: 'Expired', color: '#EF4444' },
      { id: 'low_stock', label: 'Low Stock', color: '#F59E0B' },
      { id: 'out_of_stock', label: 'Out of Stock', color: '#EF4444' },
    ],
  },
  hospitality: {
    id: 'hospitality',
    name: 'Hospitality',
    description: 'Track room supplies, amenities, and maintenance items',
    icon: 'Building2',
    color: '#06B6D4',
    primaryFields: [
      { id: 'room', label: 'Room/Area', placeholder: 'e.g., Room 101, Lobby' },
      { id: 'floor', label: 'Floor', placeholder: 'e.g., 1, 2, Ground' },
      { id: 'condition', label: 'Condition', placeholder: 'e.g., Good, Needs Repair' },
      { id: 'lastChecked', label: 'Last Checked', placeholder: 'Date' },
    ],
    categories: [
      'Linens & Towels',
      'Toiletries',
      'Room Amenities',
      'Furniture',
      'Electronics',
      'Cleaning Supplies',
      'Kitchen Equipment',
      'Maintenance Tools',
      'Safety Equipment',
      'Decorations',
      'Other',
    ],
    statusOptions: [
      { id: 'available', label: 'Available', color: '#10B981' },
      { id: 'in_use', label: 'In Use', color: '#06B6D4' },
      { id: 'needs_cleaning', label: 'Needs Cleaning', color: '#F59E0B' },
      { id: 'needs_repair', label: 'Needs Repair', color: '#EF4444' },
      { id: 'out_of_service', label: 'Out of Service', color: '#64748B' },
    ],
  },
};

interface IndustryStore {
  industry: IndustryType;
  hasCompletedOnboarding: boolean;
  setIndustry: (industry: IndustryType) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
  getConfig: () => IndustryConfig | null;
}

export const useIndustryStore = create<IndustryStore>()(
  persist(
    (set, get) => ({
      industry: null,
      hasCompletedOnboarding: false,
      setIndustry: (industry) => set({ industry }),
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
      resetOnboarding: () => set({ industry: null, hasCompletedOnboarding: false }),
      getConfig: () => {
        const { industry } = get();
        if (!industry) return null;
        return INDUSTRY_CONFIGS[industry];
      },
    }),
    {
      name: 'industry-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
