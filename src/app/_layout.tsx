import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from '@/lib/useColorScheme';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { authClient } from '@/lib/authClient';
import { api } from '@/lib/api';
import { SidebarProvider, useSidebar } from '@/lib/sidebarContext';
import { SidebarMenu } from '@/components/SidebarMenu';
import { useIndustryStore } from '@/lib/industry-store';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // Data stays fresh for 5 minutes
      gcTime: 1000 * 60 * 30, // Cache is kept for 30 minutes
      refetchOnWindowFocus: false, // Don't refetch when app comes to foreground
      refetchOnMount: false, // Don't refetch when component mounts if data exists
      retry: 2,
    },
  },
});

function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const [isInitialized, setIsInitialized] = useState(false);
  const hasCompletedOnboarding = useIndustryStore((s) => s.hasCompletedOnboarding);

  // Check if navigation is ready
  const navigationState = useRootNavigationState();
  const isNavigationReady = !!navigationState?.key;

  // Use React Query to manage session state - this will be reactive
  const { data: sessionData, isLoading: isSessionLoading } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const session = await authClient.getSession();
      return session.data;
    },
    staleTime: 0, // Always check fresh
    gcTime: 0, // Don't cache
  });

  const isAuthenticated = !!sessionData?.session;

  useEffect(() => {
    if (!isSessionLoading && !isInitialized) {
      setIsInitialized(true);
      SplashScreen.hideAsync();
    }
  }, [isSessionLoading, isInitialized]);

  useEffect(() => {
    // Wait for both initialization and navigation to be ready
    if (!isInitialized || isSessionLoading || !isNavigationReady) return;

    const inAuthGroup = segments[0] === 'auth' || segments[0] === 'organization-setup';
    const inOnboarding = segments[0] === 'industry-selector';

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to auth screen if not authenticated
      router.replace('/auth');
    } else if (isAuthenticated && !hasCompletedOnboarding && !inOnboarding && !inAuthGroup) {
      // Redirect to industry selector if authenticated but hasn't selected industry
      router.replace('/industry-selector');
    }
  }, [isAuthenticated, segments, isInitialized, isSessionLoading, hasCompletedOnboarding, isNavigationReady]);

  if (!isInitialized || isSessionLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#06B6D4" />
      </View>
    );
  }

  return <>{children}</>;
}

function RootLayoutNav({ colorScheme }: { colorScheme: 'light' | 'dark' | null | undefined }) {
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthGuard>
        <SidebarProvider>
          <View style={{ flex: 1 }}>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="auth" options={{ headerShown: false }} />
              <Stack.Screen name="organization-setup" options={{ headerShown: false }} />
              <Stack.Screen name="industry-selector" options={{ headerShown: false }} />
              <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
              <Stack.Screen name="add-item" options={{ headerShown: false, presentation: 'modal' }} />
              <Stack.Screen name="item/[id]" options={{ headerShown: false }} />
              <Stack.Screen name="storage-settings" options={{ headerShown: false }} />
              <Stack.Screen name="import-listings" options={{ headerShown: false, presentation: 'modal' }} />
            </Stack>
            <SidebarOverlay />
          </View>
        </SidebarProvider>
      </AuthGuard>
    </ThemeProvider>
  );
}

function SidebarOverlay() {
  const { isOpen, closeSidebar } = useSidebar();
  return <SidebarMenu isOpen={isOpen} onClose={closeSidebar} />;
}



export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardProvider>
          <StatusBar style="light" />
          <RootLayoutNav colorScheme={colorScheme} />
        </KeyboardProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
