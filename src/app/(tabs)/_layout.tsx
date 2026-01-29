import React from 'react';
import { Tabs } from 'expo-router';
import { Home, Package, Scan, BarChart3, ClipboardList } from 'lucide-react-native';
import { useIndustryStore, INDUSTRY_CONFIGS } from '@/lib/industry-store';

export default function TabLayout() {
  const industry = useIndustryStore((s) => s.industry);
  const config = industry ? INDUSTRY_CONFIGS[industry] : null;

  // Use industry color as accent, fallback to cyan
  const accentColor = config?.color ?? '#06B6D4';

  // Show prep sheet tab only for restaurant industry
  const isRestaurant = industry === 'restaurant';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: accentColor,
        tabBarInactiveTintColor: '#64748B',
        tabBarStyle: {
          backgroundColor: '#1C1C1E',
          borderTopColor: '#2C2C2E',
          borderTopWidth: 1,
          height: 85,
          paddingBottom: 25,
          paddingTop: 10,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        headerStyle: {
          backgroundColor: '#1C1C1E',
        },
        headerTintColor: '#F8FAFC',
        headerTitleStyle: {
          fontWeight: '700',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: 'Inventory',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Package size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="prep-sheet"
        options={{
          title: 'Prep',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <ClipboardList size={size} color={color} />,
          href: isRestaurant ? '/prep-sheet' : null, // Only show for restaurant
        }}
      />
      <Tabs.Screen
        name="smart-scan"
        options={{
          title: 'SmartScan',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Scan size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Analytics',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <BarChart3 size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          href: null, // Hide from tabs - accessed via sidebar menu
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          href: null, // Hide from tabs but keep route accessible
        }}
      />
    </Tabs>
  );
}
