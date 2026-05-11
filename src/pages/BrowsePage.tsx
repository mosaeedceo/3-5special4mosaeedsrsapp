import { useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Library, GraduationCap } from 'lucide-react';
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
    const params = new URLSearchParams(searchParams);
    params.set('view', next);
    navigate(`/browse?${params.toString()}`, { state: location.state });
  };

  return (
    <div className="min-h-screen bg-background">
      {view === 'library' ? <LibraryPage inBrowse /> : <CategoriesPage inBrowse />}

      {/* Floating Library / Categories toggle */}
      <div className="fixed bottom-28 md:bottom-32 lg:bottom-24 left-1/2 -translate-x-1/2 z-40">
        <div className="flex items-center bg-card border border-border shadow-lg rounded-full p-1 gap-1 md:p-1.5 md:gap-1.5 lg:p-1 lg:gap-1">
          <button
            type="button"
            onClick={() => handleChange('library')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 md:px-5 md:py-2.5 rounded-full text-sm font-medium transition-colors',
              view === 'library'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Library className="w-4 h-4" />
            <span>{t('nav.library')}</span>
          </button>
          <button
            type="button"
            onClick={() => handleChange('categories')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 md:px-5 md:py-2.5 rounded-full text-sm font-medium transition-colors',
              view === 'categories'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <GraduationCap className="w-4 h-4" />
            <span>{t('nav.categories')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
