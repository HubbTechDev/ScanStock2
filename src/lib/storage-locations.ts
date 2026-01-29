import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_LOCATIONS_KEY = 'storage_locations_config';

export interface LocationField {
  id: string;
  name: string;
  placeholder: string;
  enabled: boolean;
}

interface StorageLocationsState {
  locationFields: LocationField[];
  isLoaded: boolean;
  loadLocations: () => Promise<void>;
  updateLocationField: (id: string, updates: Partial<LocationField>) => Promise<void>;
  addLocationField: () => Promise<void>;
  removeLocationField: (id: string) => Promise<void>;
  reorderLocationFields: (fields: LocationField[]) => Promise<void>;
}

const defaultLocationFields: LocationField[] = [
  { id: 'bin', name: 'Bin Number', placeholder: 'e.g., A1', enabled: true },
  { id: 'rack', name: 'Rack Number', placeholder: 'e.g., R01', enabled: true },
];

export const useStorageLocations = create<StorageLocationsState>((set, get) => ({
  locationFields: defaultLocationFields,
  isLoaded: false,

  loadLocations: async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_LOCATIONS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as LocationField[];
        set({ locationFields: parsed, isLoaded: true });
      } else {
        set({ isLoaded: true });
      }
    } catch (error) {
      console.error('Error loading storage locations:', error);
      set({ isLoaded: true });
    }
  },

  updateLocationField: async (id, updates) => {
    const { locationFields } = get();
    const updatedFields = locationFields.map((field) =>
      field.id === id ? { ...field, ...updates } : field
    );
    set({ locationFields: updatedFields });
    await AsyncStorage.setItem(STORAGE_LOCATIONS_KEY, JSON.stringify(updatedFields));
  },

  addLocationField: async () => {
    const { locationFields } = get();
    const newId = `custom_${Date.now()}`;
    const newField: LocationField = {
      id: newId,
      name: `Location ${locationFields.length + 1}`,
      placeholder: 'Enter value',
      enabled: true,
    };
    const updatedFields = [...locationFields, newField];
    set({ locationFields: updatedFields });
    await AsyncStorage.setItem(STORAGE_LOCATIONS_KEY, JSON.stringify(updatedFields));
  },

  removeLocationField: async (id) => {
    const { locationFields } = get();
    const updatedFields = locationFields.filter((field) => field.id !== id);
    set({ locationFields: updatedFields });
    await AsyncStorage.setItem(STORAGE_LOCATIONS_KEY, JSON.stringify(updatedFields));
  },

  reorderLocationFields: async (fields) => {
    set({ locationFields: fields });
    await AsyncStorage.setItem(STORAGE_LOCATIONS_KEY, JSON.stringify(fields));
  },
}));
