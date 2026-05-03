import { useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Library, GraduationCap } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDisplayMode } from '@/hooks/useDisplayMode';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useTranslation } from '@/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { LibraryPage } from './LibraryPage';
import { CategoriesPage } from './CategoriesPage';

const SESSION_VIEW_KEY = 'browse-view-preference';
type BrowseView = 'library' | 'categories';

const isBrowseView = (v: string | null): v is BrowseView =>
  v === 'library' || v === 'categories';

export const BrowsePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { data } = useLocalStorage();
  const { containerClass } = useDisplayMode(data.settings.displayMode);
  const { t } = useTranslation();

  const viewParam = searchParams.get('view');
  const storedView = sessionStorage.getItem(SESSION_VIEW_KEY);
  const view: BrowseView = isBrowseView(viewParam)
    ? viewParam
    : isBrowseView(storedView)
      ? storedView
      : 'library';

  // Ensure URL always reflects the active view, and persist preference.
  useEffect(() => {
    if (viewParam !== view) {
      const next = new URLSearchParams(searchParams);
      next.set('view', view);
      setSearchParams(next, { replace: true, state: location.state });
    }
    sessionStorage.setItem(SESSION_VIEW_KEY, view);
  }, [view, viewParam, searchParams, setSearchParams, location.state]);

  const handleChange = (next: string) => {
    if (!isBrowseView(next) || next === view) return;
    sessionStorage.setItem(SESSION_VIEW_KEY, next);
    navigate(`/browse?view=${next}`, { state: location.state });
  };

  return (
    <div className="min-h-screen bg-background">
      <div
        className={cn(
          'sticky top-0 z-30 bg-card/95 backdrop-blur-md border-b border-border px-4 pt-3 pb-3'
        )}
      >
        <div className={cn(containerClass, 'mx-auto')}>
          <Tabs value={view} onValueChange={handleChange} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="library" className="gap-2">
                <Library className="w-4 h-4" />
                <span>{t('nav.library')}</span>
              </TabsTrigger>
              <TabsTrigger value="categories" className="gap-2">
                <GraduationCap className="w-4 h-4" />
                <span>{t('nav.categories')}</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {view === 'library' ? <LibraryPage /> : <CategoriesPage />}
    </div>
  );
};
