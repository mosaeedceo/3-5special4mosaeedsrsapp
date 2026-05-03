import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { BrowsePage } from "./pages/BrowsePage";
import { StatsPage } from "./pages/StatsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { UserGuidePage } from "./pages/UserGuidePage";
import { FlashcardsPage } from "./pages/FlashcardsPage";
import { DeckReviewPage } from "./pages/DeckReviewPage";
import { BottomNav } from "./components/BottomNav";
import NotFound from "./pages/NotFound";
import { useEffect } from "react";
import { isNativePlatform } from "@/lib/platform";
import { loadTheme, applyTheme } from "@/lib/themeStorage";
import { incrementQuoteIndex } from "@/lib/quoteStorage";
import { useLanguage } from "@/hooks/useTranslation";
import { en } from "@/lib/translations/en";
import { ar } from "@/lib/translations/ar";
import { LocalStorageProvider, useLocalStorage } from "@/hooks/useLocalStorage";
import { SessionHistoryProvider } from "@/contexts/SessionHistoryContext";
import { Toaster } from "@/components/ui/toaster";

const queryClient = new QueryClient();

// ============= IMMEDIATE THEME INITIALIZATION =============
// This runs BEFORE React mounts to prevent flash of wrong theme
const initializeThemeImmediate = async () => {
  try {
    // 1. Load and apply color theme (lavender, tide, etc.)
    const savedColorTheme = await loadTheme();
    if (savedColorTheme) {
      applyTheme(savedColorTheme);
    }
    
    // 2. Load and apply dark/light mode
    let themeMode: string | null = null;
    
    if (isNativePlatform()) {
      try {
        const { Preferences } = await import('@capacitor/preferences');
        
        // First try dedicated theme-mode key
        const result = await Preferences.get({ key: 'theme-mode' });
        if (result.value) {
          themeMode = result.value;
          console.log('[App] Theme mode loaded from Preferences:', themeMode);
        } else {
          // Fallback: read from full app data
          const dataResult = await Preferences.get({ key: 'spaced-repetition-data' });
          if (dataResult.value) {
            const data = JSON.parse(dataResult.value);
            themeMode = data.settings?.theme || 'light';
            console.log('[App] Theme mode loaded from app data:', themeMode);
          }
        }
      } catch (e) {
        console.error('[App] Error loading theme from Preferences:', e);
      }
    } else {
      // Web: read from localStorage
      const stored = localStorage.getItem('spaced-repetition-data');
      if (stored) {
        const data = JSON.parse(stored);
        themeMode = data.settings?.theme || 'light';
      }
    }
    
    // Apply dark/light mode immediately
    if (themeMode === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (themeMode === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', prefersDark);
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    console.log('[App] Immediate theme initialization complete');
  } catch (e) {
    console.error('[App] Failed to initialize theme immediately:', e);
  }
};

// Execute theme init immediately (before React renders)
initializeThemeImmediate();

// Component to handle RTL direction
const RTLWrapper = ({ children }: { children: React.ReactNode }) => {
  const language = useLanguage();
  
  useEffect(() => {
    const isRTL = language === 'ar';
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
    
    // Also apply a class for CSS targeting if needed
    if (isRTL) {
      document.documentElement.classList.add('rtl');
      document.documentElement.classList.remove('ltr');
    } else {
      document.documentElement.classList.add('ltr');
      document.documentElement.classList.remove('rtl');
    }
  }, [language]);
  
  return <>{children}</>;
};

const RedirectToBrowse = ({ view }: { view: 'library' | 'categories' }) => {
  const location = useLocation();
  return (
    <Navigate to={`/browse?view=${view}`} replace state={location.state} />
  );
};

const AppContent = () => {
  const { data } = useLocalStorage();

  // Increment quote index on each app launch
  useEffect(() => {
    incrementQuoteIndex();
  }, []);

  // T010: Auto-reschedule daily notification on app load (native only)
  useEffect(() => {
    if (!isNativePlatform() || !data.settings.reminderEnabled || !data.settings.reminderTime) return;
    const reschedule = async () => {
      try {
        const { LocalNotifications } = await import('@capacitor/local-notifications');
        const perm = await LocalNotifications.checkPermissions();
        if (perm.display !== 'granted') return;
        const [hours, minutes] = data.settings.reminderTime!.split(':').map(Number);
        await LocalNotifications.cancel({ notifications: [{ id: 1 }] });
        const lang = data.settings.language === 'ar' ? ar : en;
        await LocalNotifications.schedule({
          notifications: [{
            id: 1,
            title: lang.notifications.title,
            body: lang.notifications.body,
            schedule: { on: { hour: hours, minute: minutes }, repeats: true, allowWhileIdle: true },
          }],
        });
      } catch {
        // Silently fail — notification rescheduling is non-critical
      }
    };
    reschedule();
  }, [data.settings.reminderEnabled, data.settings.reminderTime]);


  return (
    <RTLWrapper>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/browse" element={<BrowsePage />} />
        <Route path="/library" element={<RedirectToBrowse view="library" />} />
        <Route path="/categories" element={<RedirectToBrowse view="categories" />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/flashcards" element={<FlashcardsPage />} />
        <Route path="/flashcards/:deckId/review" element={<DeckReviewPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/guide" element={<UserGuidePage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <BottomNav />
    </RTLWrapper>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <LocalStorageProvider>
        <SessionHistoryProvider>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <AppContent />
          </BrowserRouter>
          <Toaster />
        </SessionHistoryProvider>
      </LocalStorageProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
